const assert = require("node:assert/strict");
const db = require("../config/database");
const M = require("../models");
const Evidence = require("../services/partnerEvidenceService");
const suffix = String(Date.now());
let partner, programme, campaign, cohort, staff, assignment;
const users = [];
const members = [];
const originalApproval = process.env.PARTNER_EVIDENCE_APPROVED_PROGRAMME_IDS;
async function main() {
  await db.authenticate();
  staff = await M.User.create({
    email: `ht331-staff-${suffix}@example.com`,
    password: "fixture-only",
    role: "user",
    is_verified: true,
  });
  users.push(staff.id);
  partner = await M.Partner.create({
    name: `HT331 ${suffix}`,
    partner_type: "other",
    status: "active",
    reporting_mode: "aggregate_only",
  });
  programme = await M.PartnerProgramme.create({
    partner_id: partner.id,
    programme_key: `ht331-${suffix}`,
    name: "Fixture programme",
    status: "active",
  });
  campaign = await M.PartnerCampaign.create({
    partner_programme_id: programme.id,
    campaign_key: `ht331-${suffix}`,
    name: "Fixture campaign",
    status: "active",
  });
  cohort = await M.PartnerCohort.create({
    partner_id: partner.id,
    partner_programme_id: programme.id,
    partner_campaign_id: campaign.id,
    cohort_key: `ht331-${suffix}`,
    name: "Fixture cohort",
    status: "active",
    reporting_level: "aggregate_only",
  });
  assignment = await M.PartnerProgrammeAccess.create({
    partner_id: partner.id,
    partner_programme_id: programme.id,
    user_id: staff.id,
    access_role: "analyst",
    status: "active",
    granted_at: new Date(),
  });
  const now = new Date();
  const month = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  )
    .toISOString()
    .slice(0, 7);
  const occurred = new Date(`${month}-15T12:00:00Z`);
  for (let i = 0; i < 10; i += 1) {
    const user = await M.User.create({
      email: `ht331-${i}-${suffix}@example.com`,
      password: "fixture-only",
      role: "user",
      is_verified: true,
    });
    users.push(user.id);
    const member = await M.CohortMember.create({
      partner_cohort_id: cohort.id,
      user_id: user.id,
      membership_status: "active",
      joined_at: new Date(`${month}-01T00:00:00Z`),
    });
    members.push(member);
    for (const scope of [
      "hometruth_processing",
      "aggregate_analytics",
      "partner_reporting",
    ])
      await M.ConsentRecord.create({
        partner_id: partner.id,
        partner_cohort_id: cohort.id,
        cohort_member_id: member.id,
        user_id: user.id,
        consent_scope: scope,
        consent_type:
          scope === "hometruth_processing"
            ? "processing"
            : scope === "partner_reporting"
              ? "reporting"
              : "analytics",
        consent_version: "fixture-v1",
        status: "granted",
        granted_at: occurred,
        recorded_at: occurred,
      });
    if (i < 5)
      await M.PilotEvent.create({
        event_name: "signup_completed",
        partner_id: partner.id,
        partner_programme_id: programme.id,
        partner_campaign_id: campaign.id,
        partner_cohort_id: cohort.id,
        cohort_member_id: member.id,
        user_id: user.id,
        consent_scope: "aggregate_analytics",
        partner_context_allowed: true,
        occurred_at: occurred,
        metadata: { forbidden: "PRIVATE-FIXTURE-CONTENT" },
      });
  }
  delete process.env.PARTNER_EVIDENCE_APPROVED_PROGRAMME_IDS;
  assert.equal(
    (await Evidence.report(staff.id, programme.id, { month })).state,
    "approval_required",
  );
  process.env.PARTNER_EVIDENCE_APPROVED_PROGRAMME_IDS = String(programme.id);
  const report = await Evidence.report(staff.id, programme.id, { month });
  assert.equal(report.partitions[0].eligibleParticipants, 10);
  assert.equal(report.partitions[0].metrics[0].count, 5);
  for (const forbidden of [
    "PRIVATE-FIXTURE-CONTENT",
    "user_id",
    "cohort_member_id",
    "property_id",
    "email",
    "metadata",
  ])
    assert.equal(JSON.stringify(report).includes(forbidden), false);
  assert.equal(
    (
      await Evidence.report(
        staff.id,
        programme.id,
        { month, campaignId: String(campaign.id) },
        true,
      )
    ).partitions[0].metrics[0].count,
    5,
  );
  await assert.rejects(
    Evidence.report(staff.id, programme.id, {
      month,
      campaignId: "2147483647",
    }),
    (error) => error.statusCode === 404,
  );
  for (const partnerType of [
    "insurer",
    "mortgage_provider",
    "home_developer",
    "other",
  ]) {
    await partner.update({ partner_type: partnerType });
    for (const role of ["sponsor", "programme_manager", "analyst"]) {
      await assignment.update({ access_role: role });
      assert.equal(
        (await Evidence.report(staff.id, programme.id, { month })).partitions[0]
          .metrics[0].count,
        5,
      );
    }
  }
  const duplicate = await M.CohortMember.create({
    partner_cohort_id: cohort.id,
    user_id: members[0].user_id,
    membership_status: "active",
    joined_at: occurred,
  });
  assert.equal(
    (
      await Evidence.report(staff.id, programme.id, {
        month,
        campaignId: String(campaign.id),
      })
    ).partitions[0].state,
    "suppressed",
  );
  await duplicate.destroy();
  await assignment.update({ access_role: "privacy_auditor" });
  assert.equal(
    (await Evidence.definitions(staff.id, programme.id)).metrics.length,
    8,
  );
  await assert.rejects(
    Evidence.report(staff.id, programme.id, { month }),
    (error) => error.statusCode === 403,
  );
  await assignment.update({ access_role: "analyst" });
  await M.ConsentRecord.update(
    { status: "withdrawn", withdrawn_at: new Date() },
    {
      where: {
        cohort_member_id: members[0].id,
        consent_scope: "partner_reporting",
      },
    },
  );
  const withdrawn = await Evidence.report(staff.id, programme.id, { month });
  assert.equal(withdrawn.partitions[0].state, "suppressed");
  assert.equal(withdrawn.partitions[0].eligibleParticipants, null);
  assert.deepEqual(withdrawn.partitions[0].metrics, []);
  await M.ConsentRecord.update(
    { status: "granted" },
    {
      where: {
        cohort_member_id: members[0].id,
        consent_scope: "partner_reporting",
      },
    },
  );
  const originalFind = M.PilotEvent.findAll;
  M.PilotEvent.findAll = async function (...args) {
    const rows = await originalFind.apply(this, args);
    await M.ConsentRecord.update(
      { status: "withdrawn" },
      {
        where: {
          cohort_member_id: members[0].id,
          consent_scope: "partner_reporting",
        },
      },
    );
    return rows;
  };
  try {
    await assert.rejects(
      Evidence.report(staff.id, programme.id, { month }),
      (error) => error.statusCode === 409,
    );
  } finally {
    M.PilotEvent.findAll = originalFind;
  }
  await programme.update({ status: "paused" });
  await assert.rejects(
    Evidence.report(staff.id, programme.id, { month }),
    (error) => error.statusCode === 403,
  );
  await programme.update({ status: "active" });
  await assignment.update({ status: "revoked" });
  await assert.rejects(
    Evidence.report(staff.id, programme.id, { month }),
    (error) => error.statusCode === 403,
  );
  assert(
    await M.PartnerAccessAuditEvent.count({
      where: {
        partner_programme_id: programme.id,
        event_type: "report_exported",
      },
    }),
  );
  console.log(
    "Partner evidence MySQL smoke passed: approval, scoped filters, consent withdrawal, suppression, roles, lifecycle/revoke denial, export/audit and privacy.",
  );
}
async function cleanup() {
  if (programme)
    await M.PartnerAccessAuditEvent.destroy({
      where: { partner_programme_id: programme.id },
    });
  if (cohort) {
    for (const model of [M.PilotEvent, M.ConsentRecord, M.CohortMember])
      await model.destroy({ where: { partner_cohort_id: cohort.id } });
    await cohort.destroy();
  }
  if (programme)
    await M.PartnerProgrammeAccess.destroy({
      where: { partner_programme_id: programme.id },
    });
  if (campaign) await campaign.destroy();
  if (programme) await programme.destroy();
  if (partner) await partner.destroy();
  if (users.length) await M.User.destroy({ where: { id: users } });
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (originalApproval === undefined)
      delete process.env.PARTNER_EVIDENCE_APPROVED_PROGRAMME_IDS;
    else process.env.PARTNER_EVIDENCE_APPROVED_PROGRAMME_IDS = originalApproval;
    try {
      await cleanup();
    } finally {
      await db.close();
    }
  });
