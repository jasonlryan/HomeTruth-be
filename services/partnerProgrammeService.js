const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  Partner,
  PartnerCampaign,
  PartnerCohort,
  PartnerProgramme,
  PartnerProgrammeAuditEvent,
  User,
} = require("../models");

const PARTNER_TYPES = new Set([
  "insurer",
  "mortgage_provider",
  "home_developer",
  "other",
]);
const INVITE_MODES = new Set(["cohort_code", "individual_invite", "both"]);
const TRANSITIONS = {
  draft: new Set(["active", "closed"]),
  active: new Set(["paused", "closed"]),
  paused: new Set(["active", "closed"]),
  closed: new Set(),
};

class PartnerProgrammeError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "PartnerProgrammeError";
    this.statusCode = statusCode;
  }
}

const value = (record, key) => record?.[key] ?? record?.dataValues?.[key];

const requiredString = (input, label, maxLength) => {
  if (typeof input !== "string" || !input.trim()) {
    throw new PartnerProgrammeError(`${label} is required`);
  }
  const normalized = input.trim();
  if (normalized.length > maxLength) {
    throw new PartnerProgrammeError(`${label} must be ${maxLength} characters or fewer`);
  }
  return normalized;
};

const optionalString = (input, label, maxLength) => {
  if (input === undefined || input === null || input === "") return null;
  return requiredString(input, label, maxLength);
};

const positiveInteger = (input, label, { required = false } = {}) => {
  if (input === undefined || input === null || input === "") {
    if (required) throw new PartnerProgrammeError(`${label} is required`);
    return null;
  }
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new PartnerProgrammeError(`${label} must be a positive integer`);
  }
  return parsed;
};

const dateOnly = (input, label) => {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new PartnerProgrammeError(`${label} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input) {
    throw new PartnerProgrammeError(`${label} must be a valid date`);
  }
  return input;
};

const validateDateRange = (startDate, endDate, label) => {
  if (startDate && endDate && startDate > endDate) {
    throw new PartnerProgrammeError(`${label} start date must not be after its end date`);
  }
};

const jsonObject = (input, label) => {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new PartnerProgrammeError(`${label} must be an object`);
  }
  return input;
};

const stringArray = (input, label) => {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) {
    throw new PartnerProgrammeError(`${label} must be an array`);
  }
  const normalized = input.map((item) => requiredString(item, label, 255));
  return [...new Set(normalized)];
};

const normalizePartnerType = (input) => {
  const aliases = {
    lender: "mortgage_provider",
    property_developer: "home_developer",
  };
  const normalized = aliases[input] || input;
  if (!PARTNER_TYPES.has(normalized)) {
    throw new PartnerProgrammeError(
      "partnerType must be insurer, mortgage_provider, home_developer or other"
    );
  }
  return normalized;
};

const toPartnerResponse = (partner) => ({
  id: value(partner, "id"),
  name: value(partner, "name"),
  partnerType:
    {
      lender: "mortgage_provider",
      property_developer: "home_developer",
    }[value(partner, "partner_type")] || value(partner, "partner_type"),
  status: value(partner, "status"),
  reportingMode: value(partner, "reporting_mode"),
});

const toCampaignResponse = (campaign) => ({
  id: value(campaign, "id"),
  campaignKey: value(campaign, "campaign_key"),
  name: value(campaign, "name"),
  status: value(campaign, "status"),
  inviteRoute: value(campaign, "invite_route"),
  approvedContentRef: value(campaign, "approved_content_ref"),
  startDate: value(campaign, "start_date"),
  endDate: value(campaign, "end_date"),
});

const toCohortResponse = (cohort) => ({
  id: value(cohort, "id"),
  cohortKey: value(cohort, "cohort_key"),
  name: value(cohort, "name"),
  status: value(cohort, "status"),
  targetSize: value(cohort, "target_size"),
  reportingLevel: value(cohort, "reporting_level"),
  startDate: value(cohort, "start_date"),
  endDate: value(cohort, "end_date"),
  campaignId: value(cohort, "partner_campaign_id"),
});

const toAuditResponse = (event) => ({
  id: value(event, "id"),
  eventType: value(event, "event_type"),
  actorUserId: value(event, "actor_user_id"),
  previousStatus: value(event, "previous_status"),
  newStatus: value(event, "new_status"),
  changes: value(event, "changes") || {},
  occurredAt: value(event, "occurred_at"),
});

const toProgrammeResponse = (programme, { includeAudit = false } = {}) => ({
  id: value(programme, "id"),
  programmeKey: value(programme, "programme_key"),
  name: value(programme, "name"),
  status: value(programme, "status"),
  ownerUserId: value(programme, "owner_user_id"),
  startDate: value(programme, "start_date"),
  endDate: value(programme, "end_date"),
  entitlement: value(programme, "entitlement") || {},
  inviteMode: value(programme, "invite_mode"),
  approvedContentRefs: value(programme, "approved_content_refs") || [],
  activatedAt: value(programme, "activated_at"),
  pausedAt: value(programme, "paused_at"),
  closedAt: value(programme, "closed_at"),
  createdAt: value(programme, "createdAt") || value(programme, "created_at"),
  updatedAt: value(programme, "updatedAt") || value(programme, "updated_at"),
  partner: programme?.Partner ? toPartnerResponse(programme.Partner) : null,
  campaigns: (programme?.PartnerCampaigns || []).map(toCampaignResponse),
  cohorts: (programme?.PartnerCohorts || []).map(toCohortResponse),
  ...(includeAudit
    ? {
        auditEvents: (programme?.PartnerProgrammeAuditEvents || []).map(
          toAuditResponse
        ),
      }
    : {}),
});

const programmeInclude = (includeAudit = false) => [
  { model: Partner, required: true },
  { model: PartnerCampaign, required: false },
  { model: PartnerCohort, required: false },
  ...(includeAudit
    ? [
        {
          model: PartnerProgrammeAuditEvent,
          required: false,
          separate: true,
          order: [["occurred_at", "DESC"]],
        },
      ]
    : []),
];

const loadProgramme = async (id, options = {}) => {
  const programmeId = positiveInteger(id, "programmeId", { required: true });
  const programme = await PartnerProgramme.findByPk(programmeId, {
    include: programmeInclude(Boolean(options.includeAudit)),
    transaction: options.transaction,
    lock: options.lock,
  });
  if (!programme) throw new PartnerProgrammeError("Partner programme not found", 404);
  return programme;
};

const assertAdminOwner = async (ownerUserId, transaction) => {
  const owner = await User.findOne({
    where: { id: ownerUserId, role: "admin" },
    transaction,
  });
  if (!owner) {
    throw new PartnerProgrammeError("Programme owner must be a HomeTruth administrator");
  }
};

const buildProgrammeInput = (payload, actorUserId) => {
  const startDate = dateOnly(payload.startDate, "Programme start date");
  const endDate = dateOnly(payload.endDate, "Programme end date");
  validateDateRange(startDate, endDate, "Programme");
  const inviteMode = payload.inviteMode || "cohort_code";
  if (!INVITE_MODES.has(inviteMode)) {
    throw new PartnerProgrammeError(
      "inviteMode must be cohort_code, individual_invite or both"
    );
  }
  return {
    programme_key: requiredString(payload.programmeKey, "programmeKey", 120),
    name: requiredString(payload.name, "Programme name", 180),
    owner_user_id:
      positiveInteger(payload.ownerUserId, "ownerUserId") || actorUserId,
    start_date: startDate,
    end_date: endDate,
    entitlement: jsonObject(payload.entitlement, "entitlement"),
    invite_mode: inviteMode,
    approved_content_refs: stringArray(
      payload.approvedContentRefs,
      "approvedContentRefs"
    ),
  };
};

const buildCampaignInput = (payload) => {
  if (!payload) return null;
  const startDate = dateOnly(payload.startDate, "Campaign start date");
  const endDate = dateOnly(payload.endDate, "Campaign end date");
  validateDateRange(startDate, endDate, "Campaign");
  return {
    campaign_key: requiredString(payload.campaignKey, "campaignKey", 120),
    name: requiredString(payload.name, "Campaign name", 180),
    invite_route: optionalString(payload.inviteRoute, "inviteRoute", 255),
    approved_content_ref: optionalString(
      payload.approvedContentRef,
      "approvedContentRef",
      255
    ),
    start_date: startDate,
    end_date: endDate,
  };
};

const buildCohortInput = (payload) => {
  if (!payload) return null;
  const startDate = dateOnly(payload.startDate, "Cohort start date");
  const endDate = dateOnly(payload.endDate, "Cohort end date");
  validateDateRange(startDate, endDate, "Cohort");
  return {
    cohort_key: requiredString(payload.cohortKey, "cohortKey", 120),
    name: requiredString(payload.name, "Cohort name", 180),
    target_size: positiveInteger(payload.targetSize, "targetSize"),
    external_ref: optionalString(payload.externalRef, "cohort externalRef", 255),
    reporting_level: "aggregate_only",
    start_date: startDate,
    end_date: endDate,
  };
};

class PartnerProgrammeService {
  static async listPartners() {
    const partners = await Partner.findAll({
      attributes: ["id", "name", "partner_type", "status", "reporting_mode"],
      order: [["name", "ASC"]],
    });
    return partners.map(toPartnerResponse);
  }

  static async listProgrammes(filters = {}) {
    const where = {};
    if (filters.status) {
      if (!Object.hasOwn(TRANSITIONS, filters.status)) {
        throw new PartnerProgrammeError("Invalid programme status filter");
      }
      where.status = filters.status;
    }
    if (filters.partnerId) {
      where.partner_id = positiveInteger(filters.partnerId, "partnerId", {
        required: true,
      });
    }
    const programmes = await PartnerProgramme.findAll({
      where,
      include: programmeInclude(false),
      order: [["updated_at", "DESC"]],
    });
    return programmes.map((programme) => toProgrammeResponse(programme));
  }

  static async getProgramme(id) {
    const programme = await loadProgramme(id, { includeAudit: true });
    return toProgrammeResponse(programme, { includeAudit: true });
  }

  static async createProgramme(payload = {}, actorUserId) {
    const actorId = positiveInteger(actorUserId, "actorUserId", { required: true });
    const programmeId = await sequelize.transaction(async (transaction) => {
      const programmeInput = buildProgrammeInput(payload, actorId);
      await assertAdminOwner(programmeInput.owner_user_id, transaction);

      let partner;
      if (payload.partnerId) {
        partner = await Partner.findByPk(
          positiveInteger(payload.partnerId, "partnerId", { required: true }),
          { transaction }
        );
        if (!partner) throw new PartnerProgrammeError("Partner not found", 404);
        if (value(partner, "status") === "archived") {
          throw new PartnerProgrammeError("Archived partners cannot receive new programmes");
        }
      } else {
        const partnerInput = payload.partner || {};
        partner = await Partner.create(
          {
            name: requiredString(partnerInput.name, "Partner name", 180),
            partner_type: normalizePartnerType(partnerInput.partnerType || "other"),
            status: "active",
            external_ref: optionalString(
              partnerInput.externalRef,
              "Partner externalRef",
              255
            ),
            reporting_mode: "aggregate_only",
          },
          { transaction }
        );
      }

      const programme = await PartnerProgramme.create(
        {
          ...programmeInput,
          partner_id: value(partner, "id"),
          status: "draft",
          created_by_user_id: actorId,
          updated_by_user_id: actorId,
        },
        { transaction }
      );

      const campaignInput = buildCampaignInput(payload.campaign);
      let campaign = null;
      if (campaignInput) {
        campaign = await PartnerCampaign.create(
          {
            ...campaignInput,
            partner_programme_id: value(programme, "id"),
            status: "draft",
            created_by_user_id: actorId,
            updated_by_user_id: actorId,
          },
          { transaction }
        );
      }

      const cohortInput = buildCohortInput(payload.cohort);
      if (cohortInput) {
        await PartnerCohort.create(
          {
            ...cohortInput,
            partner_id: value(partner, "id"),
            partner_programme_id: value(programme, "id"),
            partner_campaign_id: campaign ? value(campaign, "id") : null,
            status: "planned",
          },
          { transaction }
        );
      }

      await PartnerProgrammeAuditEvent.create(
        {
          partner_programme_id: value(programme, "id"),
          actor_user_id: actorId,
          event_type: "created",
          previous_status: null,
          new_status: "draft",
          changes: {
            partnerType: value(partner, "partner_type"),
            programmeKey: value(programme, "programme_key"),
            campaignConfigured: Boolean(campaignInput),
            cohortConfigured: Boolean(cohortInput),
          },
        },
        { transaction }
      );

      return value(programme, "id");
    });
    return this.getProgramme(programmeId);
  }

  static async updateProgramme(id, payload = {}, actorUserId) {
    const actorId = positiveInteger(actorUserId, "actorUserId", { required: true });
    const allowed = new Set([
      "name",
      "ownerUserId",
      "startDate",
      "endDate",
      "entitlement",
      "inviteMode",
      "approvedContentRefs",
    ]);
    const requestedKeys = Object.keys(payload);
    if (!requestedKeys.length || requestedKeys.some((key) => !allowed.has(key))) {
      throw new PartnerProgrammeError("No supported programme fields were supplied");
    }

    await sequelize.transaction(async (transaction) => {
      const programme = await loadProgramme(id, { transaction, lock: true });
      if (value(programme, "status") === "closed") {
        throw new PartnerProgrammeError("Closed programmes cannot be changed", 409);
      }
      const current = {
        programmeKey: value(programme, "programme_key"),
        name: value(programme, "name"),
        ownerUserId: value(programme, "owner_user_id"),
        startDate: value(programme, "start_date"),
        endDate: value(programme, "end_date"),
        entitlement: value(programme, "entitlement"),
        inviteMode: value(programme, "invite_mode"),
        approvedContentRefs: value(programme, "approved_content_refs"),
      };
      const normalized = buildProgrammeInput({ ...current, ...payload }, actorId);
      await assertAdminOwner(normalized.owner_user_id, transaction);
      const changes = {};
      for (const key of requestedKeys) changes[key] = payload[key];
      await programme.update(
        { ...normalized, updated_by_user_id: actorId },
        { transaction }
      );
      await PartnerProgrammeAuditEvent.create(
        {
          partner_programme_id: value(programme, "id"),
          actor_user_id: actorId,
          event_type: "updated",
          previous_status: value(programme, "status"),
          new_status: value(programme, "status"),
          changes,
        },
        { transaction }
      );
    });
    return this.getProgramme(id);
  }

  static async transitionProgramme(id, nextStatus, actorUserId) {
    const actorId = positiveInteger(actorUserId, "actorUserId", { required: true });
    if (!Object.hasOwn(TRANSITIONS, nextStatus)) {
      throw new PartnerProgrammeError("Invalid programme status");
    }

    await sequelize.transaction(async (transaction) => {
      const programme = await loadProgramme(id, { transaction, lock: true });
      const currentStatus = value(programme, "status");
      if (!TRANSITIONS[currentStatus]?.has(nextStatus)) {
        throw new PartnerProgrammeError(
          `Programme cannot transition from ${currentStatus} to ${nextStatus}`,
          409
        );
      }

      if (nextStatus === "active") {
        if (value(programme.Partner, "status") !== "active") {
          throw new PartnerProgrammeError(
            "Programme cannot activate while its partner is not active",
            409
          );
        }
        const [campaignCount, cohortCount] = await Promise.all([
          PartnerCampaign.count({
            where: { partner_programme_id: value(programme, "id") },
            transaction,
          }),
          PartnerCohort.count({
            where: { partner_programme_id: value(programme, "id") },
            transaction,
          }),
        ]);
        if (!campaignCount || !cohortCount) {
          throw new PartnerProgrammeError(
            "Programme requires at least one campaign and cohort before activation",
            409
          );
        }
      }

      const now = new Date();
      const timestampChanges = {
        active: { activated_at: now, paused_at: null },
        paused: { paused_at: now },
        closed: { closed_at: now },
      }[nextStatus];
      await programme.update(
        {
          status: nextStatus,
          updated_by_user_id: actorId,
          ...timestampChanges,
        },
        { transaction }
      );

      const campaignWhere = { partner_programme_id: value(programme, "id") };
      const cohortWhere = { partner_programme_id: value(programme, "id") };
      if (nextStatus === "active") {
        campaignWhere.status = { [Op.in]: ["draft", "paused"] };
        cohortWhere.status = { [Op.in]: ["planned", "paused"] };
      } else if (nextStatus === "paused") {
        campaignWhere.status = "active";
        cohortWhere.status = "active";
      } else {
        campaignWhere.status = { [Op.ne]: "closed" };
        cohortWhere.status = { [Op.notIn]: ["closed", "archived"] };
      }
      await Promise.all([
        PartnerCampaign.update(
          { status: nextStatus, updated_by_user_id: actorId },
          { where: campaignWhere, transaction }
        ),
        PartnerCohort.update(
          { status: nextStatus === "draft" ? "planned" : nextStatus },
          { where: cohortWhere, transaction }
        ),
      ]);

      await PartnerProgrammeAuditEvent.create(
        {
          partner_programme_id: value(programme, "id"),
          actor_user_id: actorId,
          event_type: "status_changed",
          previous_status: currentStatus,
          new_status: nextStatus,
          changes: { cascadedToCampaignsAndCohorts: true },
        },
        { transaction }
      );
    });
    return this.getProgramme(id);
  }
}

PartnerProgrammeService.Error = PartnerProgrammeError;
PartnerProgrammeService.PARTNER_TYPES = PARTNER_TYPES;
PartnerProgrammeService.TRANSITIONS = TRANSITIONS;

module.exports = PartnerProgrammeService;
