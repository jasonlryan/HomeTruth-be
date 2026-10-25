const { Op } = require('sequelize');
const { PartnerCampaign, PartnerCohort, CohortMember, ConsentRecord, PilotEvent, PartnerAccessAuditEvent } = require('../models');
const Access = require('./partnerAccessService');
const Contract = require('./partnerEvidenceContract');
const REQUIRED_SCOPES = ['hometruth_processing', 'aggregate_analytics', 'partner_reporting'];
const LIMIT = 100000;
const enabled = (id) => (process.env.PARTNER_EVIDENCE_APPROVED_PROGRAMME_IDS || '').split(',').map((part) => part.trim()).includes(String(id));
const bounded = (rows) => {
  if (rows.length > LIMIT) throw new Access.Error('Report capacity exceeded; contact HomeTruth support', 503);
  return rows;
};
const audit = (access, userId, eventType, action, outcome = 'allowed', reasonCode = null) => PartnerAccessAuditEvent.create({
  partner_id: access.partner_id, partner_programme_id: access.partner_programme_id,
  partner_programme_access_id: access.id, actor_user_id: userId,
  event_type: eventType, action, resource_type: 'partner_evidence', outcome, reason_code: reasonCode,
  details: {}, occurred_at: new Date(),
});
class PartnerEvidenceService {
  static async definitions(userId, programmeId) {
    const access = await Access.authorize(userId, programmeId, 'programme:view');
    await audit(access, userId, 'report_viewed', 'report:definitions:view');
    return Contract.definitions();
  }
  static async report(userId, programmeId, input = {}, exporting = false) {
    const capability = exporting ? 'report:export' : 'report:view';
    const access = await Access.authorize(userId, programmeId, capability);
    let filters;
    try { filters = Contract.parseFilters(input); }
    catch (error) { throw new Access.Error(error.message); }
    if (!enabled(programmeId)) {
      await audit(access, userId, 'access_denied', capability, 'denied', 'reporting_approval_required');
      return { state: 'approval_required', message: 'Programme reporting awaits product and privacy approval.', definitions: Contract.definitions(), partitions: [] };
    }
    const partnerId = access.partner_id;
    const programme = access.PartnerProgramme;
    if (access.Partner.reporting_mode !== 'aggregate_only') throw new Access.Error('Aggregate reporting is unavailable', 403);
    const campaigns = await PartnerCampaign.findAll({ where: { partner_programme_id: programme.id }, attributes: ['id', 'name', 'campaign_key'], raw: true });
    if (filters.campaignId && !campaigns.some((campaign) => campaign.id === filters.campaignId)) throw new Access.Error('Campaign is not available for this programme', 404);
    const cohorts = await PartnerCohort.findAll({ where: { partner_id: partnerId, partner_programme_id: programme.id, reporting_level: 'aggregate_only', partner_campaign_id: campaigns.map((campaign) => campaign.id) }, attributes: ['id', 'partner_campaign_id'], raw: true });
    const memberQuery = { where: { partner_cohort_id: cohorts.map((cohort) => cohort.id), membership_status: { [Op.in]: ['onboarded', 'active', 'completed'] }, user_id: { [Op.ne]: null }, joined_at: { [Op.lt]: filters.end } }, attributes: ['id', 'user_id', 'partner_cohort_id'], limit: LIMIT + 1, raw: true };
    const members = bounded(await CohortMember.findAll(memberQuery));
    const byMember = new Map(members.map((member) => [member.id, member]));
    // Latest evidence wins, including a withdrawn/expired replacement. Scope is never inferred from user alone.
    const consentQuery = { where: { partner_id: partnerId, partner_cohort_id: cohorts.map((cohort) => cohort.id), cohort_member_id: members.map((member) => member.id), consent_scope: REQUIRED_SCOPES }, attributes: ['id', 'cohort_member_id', 'partner_cohort_id', 'user_id', 'consent_scope', 'status', 'recorded_at', 'granted_at'], order: [['recorded_at', 'DESC'], ['id', 'DESC']], limit: LIMIT + 1, raw: true };
    const consents = bounded(await ConsentRecord.findAll(consentQuery));
    const current = new Map();
    for (const consent of consents) {
      const member = byMember.get(consent.cohort_member_id);
      if (!member || member.user_id !== consent.user_id || member.partner_cohort_id !== consent.partner_cohort_id) continue;
      const key = `${member.id}:${consent.consent_scope}`;
      if (!current.has(key)) current.set(key, consent);
    }
    const membershipCounts = new Map();
    for (const member of members) membershipCounts.set(member.user_id, (membershipCounts.get(member.user_id) || 0) + 1);
    // Ambiguous duplicate enrolments cannot inflate totals or create overlapping campaign partitions.
    const eligible = members.filter((member) => membershipCounts.get(member.user_id) === 1 && REQUIRED_SCOPES.every((scope) => {
      const consent = current.get(`${member.id}:${scope}`);
      return consent?.status === 'granted' && consent.granted_at && new Date(consent.granted_at) <= new Date();
    }));
    const events = bounded(await PilotEvent.findAll({ where: { partner_id: partnerId, partner_programme_id: programme.id, partner_cohort_id: cohorts.map((cohort) => cohort.id), cohort_member_id: eligible.map((member) => member.id), partner_context_allowed: true, consent_scope: 'aggregate_analytics', event_name: [...new Set(Contract.METRICS.flatMap((metric) => metric.events))], occurred_at: { [Op.gte]: filters.start, [Op.lt]: filters.end } }, attributes: ['cohort_member_id', 'user_id', 'partner_cohort_id', 'partner_campaign_id', 'event_name', 'activity_date'], limit: LIMIT + 1, raw: true }));
    const cohortCampaign = new Map(cohorts.map((cohort) => [cohort.id, cohort.partner_campaign_id]));
    const safeEvents = events.filter((event) => byMember.get(event.cohort_member_id)?.user_id === event.user_id && byMember.get(event.cohort_member_id)?.partner_cohort_id === event.partner_cohort_id && cohortCampaign.get(event.partner_cohort_id) === event.partner_campaign_id && (!event.activity_date || (String(event.activity_date) >= filters.month + '-01' && String(event.activity_date) < filters.end.toISOString().slice(0, 10))));
    const partitions = campaigns.filter((campaign) => !filters.campaignId || campaign.id === filters.campaignId).map((campaign) => ({
      campaign: { id: campaign.id, name: campaign.name, campaignKey: campaign.campaign_key },
      ...Contract.aggregate(eligible.filter((member) => cohortCampaign.get(member.partner_cohort_id) === campaign.id).map((member) => member.id), safeEvents.filter((event) => event.partner_campaign_id === campaign.id)),
    }));
    // Recheck revocation/lifecycle/config before returning any calculated data.
    const finalAccess = await Access.authorize(userId, programmeId, capability);
    if (finalAccess.Partner.reporting_mode !== 'aggregate_only') throw new Access.Error('Aggregate reporting is unavailable', 403);
    const [latestMembers, latestConsents] = await Promise.all([CohortMember.findAll(memberQuery), ConsentRecord.findAll(consentQuery)]);
    const fingerprint = (rows) => JSON.stringify([...rows].sort((a, b) => a.id - b.id));
    if (fingerprint(members) !== fingerprint(latestMembers) || fingerprint(consents) !== fingerprint(latestConsents)) throw new Access.Error('Consent or membership changed during this report. Please retry.', 409);
    if (!enabled(programmeId)) throw new Access.Error('Programme reporting is unavailable', 403);
    await audit(access, userId, exporting ? 'report_exported' : 'report_viewed', capability);
    return { state: 'available', generatedAt: new Date().toISOString(), month: filters.month, programme: { id: programme.id, name: programme.name }, definitions: Contract.definitions(), partitions };
  }
}
PartnerEvidenceService.enabled = enabled;
module.exports = PartnerEvidenceService;
