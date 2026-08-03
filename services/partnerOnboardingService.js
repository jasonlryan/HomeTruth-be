const {
  CohortMember,
  ConsentRecord,
  Partner,
  PartnerCampaign,
  PartnerCohort,
  PartnerProgramme,
  Property,
  PropertyPerson,
} = require("../models");
const sequelize = require("../config/database");
const PilotAnalyticsService = require("./pilotAnalyticsService");
const {
  CONSENT_SCOPE_RULES,
  buildAcquisitionPresentation,
} = require("./partnerAcquisitionContract");

const VALID_COHORT_STATUSES = new Set(["planned", "active"]);
const VALID_MEMBER_STATUSES = new Set(["invited", "onboarded", "active"]);
const USED_MEMBER_STATUSES = new Set(["onboarded", "active", "completed"]);
const REQUIRED_CONSENT_SCOPES = CONSENT_SCOPE_RULES.filter(
  ({ required }) => required
).map(({ scope }) => scope);
const OPTIONAL_CONSENT_SCOPES = CONSENT_SCOPE_RULES.filter(
  ({ required }) => !required
).map(({ scope }) => scope);
const CONSENT_TYPE_BY_SCOPE = {
  hometruth_processing: "processing",
  partner_reporting: "reporting",
  partner_contact_servicing: "contact",
  individual_report_access: "report_access",
  aggregate_analytics: "analytics",
};

const cohortContextIncludes = () => [
  { model: Partner, required: true },
  { model: PartnerProgramme, required: false },
  { model: PartnerCampaign, required: false },
];

class PartnerOnboardingError extends Error {
  constructor(message, statusCode = 400, inviteStatus = "invalid") {
    super(message);
    this.name = "PartnerOnboardingError";
    this.statusCode = statusCode;
    this.inviteStatus = inviteStatus;
  }
}

const normalizeCode = (code) => {
  if (!code || typeof code !== "string" || !code.trim()) {
    throw new PartnerOnboardingError("Invite code is required", 400, "invalid");
  }
  return code.trim();
};

const isPastDate = (dateValue) => {
  if (!dateValue) return false;
  const end = new Date(`${dateValue}T23:59:59.999Z`);
  return end.getTime() < Date.now();
};

const toPartnerResponse = (partner) => ({
  id: partner.id,
  name: partner.name,
  partnerType: partner.partner_type,
  reportingMode: partner.reporting_mode,
});

const toCohortResponse = (cohort) => ({
  id: cohort.id,
  cohortKey: cohort.cohort_key,
  name: cohort.name,
  status: cohort.status,
  targetSize: cohort.target_size,
  reportingLevel: cohort.reporting_level,
  startDate: cohort.start_date,
  endDate: cohort.end_date,
});

const toProgrammeResponse = (programme) => {
  if (!programme) return null;
  return {
    id: programme.id,
    programmeKey: programme.programme_key,
    name: programme.name,
    status: programme.status,
  };
};

const toCampaignResponse = (campaign) => {
  if (!campaign) return null;
  return {
    id: campaign.id,
    campaignKey: campaign.campaign_key,
    name: campaign.name,
    status: campaign.status,
  };
};

const toMemberResponse = (member) => {
  if (!member) return null;
  return {
    id: member.id,
    partnerCohortId: member.partner_cohort_id,
    userId: member.user_id,
    propertyId: member.property_id,
    membershipStatus: member.membership_status,
    sourceType: member.source_type,
    invitedAt: member.invited_at,
    joinedAt: member.joined_at,
    endedAt: member.ended_at,
  };
};

const toConsentResponse = (record) => ({
  id: record.id,
  partnerId: record.partner_id,
  partnerCohortId: record.partner_cohort_id,
  cohortMemberId: record.cohort_member_id,
  userId: record.user_id,
  propertyId: record.property_id,
  consentScope: record.consent_scope,
  consentType: record.consent_type,
  consentVersion: record.consent_version,
  status: record.status,
  grantedAt: record.granted_at,
  withdrawnAt: record.withdrawn_at,
  recordedAt: record.recorded_at,
  sourceType: record.source_type,
});

const acquisitionContext = (partner, cohort) => {
  const programme = cohort?.PartnerProgramme || null;
  const campaign = cohort?.PartnerCampaign || null;
  const acquisition = buildAcquisitionPresentation({
    partner,
    programme,
    campaign,
    cohort,
  });
  return {
    programme: toProgrammeResponse(programme),
    campaign: toCampaignResponse(campaign),
    acquisition,
    branding: acquisition,
    consentContract: acquisition.consentContract,
    requiredConsentScopes: acquisition.consentContract.scopes
      .filter(({ required }) => required)
      .map(({ scope }) => scope),
    optionalConsentScopes: acquisition.consentContract.scopes
      .filter(({ required }) => !required)
      .map(({ scope }) => scope),
  };
};

const publicMemberResponse = (member) =>
  member ? { membershipStatus: member.membership_status } : null;

const consentStateForMember = async (member, userId, consentContract) => {
  if (!member?.id || !userId) {
    return { version: consentContract.version, completed: false, choices: {} };
  }
  const records = await ConsentRecord.findAll({
    where: {
      cohort_member_id: member.id,
      user_id: userId,
      consent_version: consentContract.version,
      consent_scope: consentContract.scopes.map(({ scope }) => scope),
    },
    order: [
      ["recorded_at", "DESC"],
      ["id", "DESC"],
    ],
  });
  const choices = {};
  for (const record of records) {
    if (choices[record.consent_scope] === undefined) {
      choices[record.consent_scope] = record.status === "granted";
    }
  }
  const completed = consentContract.scopes
    .filter(({ required }) => required)
    .every(({ scope }) => choices[scope] === true);
  return { version: consentContract.version, completed, choices };
};

const recordPilotEventSilently = async (payload) => {
  try {
    return await PilotAnalyticsService.recordEvent(payload);
  } catch (error) {
    console.error("Pilot event capture failed:", error.message);
    return null;
  }
};

const validateCohortState = (partner, cohort, inviteMode = null) => {
  if (!partner || partner.status !== "active") {
    return {
      status: "ineligible",
      message: "This partner pilot is not currently available.",
    };
  }

  if (cohort.PartnerProgramme && cohort.PartnerProgramme.status !== "active") {
    return {
      status: "ineligible",
      message: "This partner programme is not currently accepting onboarding.",
    };
  }

  if (cohort.PartnerProgramme && inviteMode) {
    const configuredMode = cohort.PartnerProgramme.invite_mode;
    const modeAllowed =
      configuredMode === "both" ||
      (configuredMode === "cohort_code" && inviteMode === "cohort_code") ||
      (configuredMode === "individual_invite" && inviteMode === "individual_invite");
    if (!modeAllowed) {
      return {
        status: "ineligible",
        message: "This invite route is not enabled for the partner programme.",
      };
    }
  }

  if (cohort.PartnerCampaign && cohort.PartnerCampaign.status !== "active") {
    return {
      status: "ineligible",
      message: "This partner campaign is not currently accepting onboarding.",
    };
  }

  if (isPastDate(cohort.end_date)) {
    return {
      status: "expired",
      message: "This invite has expired.",
    };
  }

  if (!VALID_COHORT_STATUSES.has(cohort.status)) {
    return {
      status: "ineligible",
      message: "This cohort is not currently accepting onboarding.",
    };
  }

  return null;
};

const buildInviteResponse = ({
  code,
  mode,
  partner,
  cohort,
  member = null,
  includeMemberIdentifiers = false,
}) => {
  const context = acquisitionContext(partner, cohort);
  const response = (status, message, responseMember = member) => ({
    invite: { code, mode, status, message },
    partner: toPartnerResponse(partner),
    cohort: toCohortResponse(cohort),
    member: includeMemberIdentifiers
      ? toMemberResponse(responseMember)
      : publicMemberResponse(responseMember),
    ...context,
  });
  const blocked = validateCohortState(partner, cohort, mode);
  if (blocked) {
    return response(blocked.status, blocked.message);
  }

  if (member) {
    if (!VALID_MEMBER_STATUSES.has(member.membership_status)) {
      return response(
        "ineligible",
        "This invite is no longer eligible for onboarding."
      );
    }

    if (member.user_id && USED_MEMBER_STATUSES.has(member.membership_status)) {
      return response(
        "already_used",
        "This invite has already been used.",
        null
      );
    }
  }

  return response("valid", "Invite is valid.");
};

const claimedInviteResponse = async ({ code, mode, partner, cohort, member, userId }) => {
  const context = acquisitionContext(partner, cohort);
  return {
    invite: { code, mode, status: "valid", message: "Invite is valid." },
    partner: toPartnerResponse(partner),
    cohort: toCohortResponse(cohort),
    member: toMemberResponse(member),
    ...context,
    consentState: await consentStateForMember(
      member,
      userId,
      context.consentContract
    ),
  };
};

class PartnerOnboardingService {
  static async validateInvite(code) {
    const normalizedCode = normalizeCode(code);

    const member = await CohortMember.findOne({
      where: { external_member_ref: normalizedCode },
      include: [
        {
          model: PartnerCohort,
          required: true,
          include: cohortContextIncludes(),
        },
      ],
    });

    if (member) {
      return buildInviteResponse({
        code: normalizedCode,
        mode: "individual_invite",
        partner: member.PartnerCohort.Partner,
        cohort: member.PartnerCohort,
        member,
      });
    }

    const cohort = await PartnerCohort.findOne({
      where: { cohort_key: normalizedCode },
      include: cohortContextIncludes(),
    });

    if (!cohort) {
      const acquisition = buildAcquisitionPresentation({
        partner: { name: null, partner_type: null },
        programme: null,
        campaign: null,
        cohort: { name: null },
      });
      return {
        invite: {
          code: normalizedCode,
          mode: "unknown",
          status: "invalid",
          message: "Invite code was not recognised.",
        },
        partner: null,
        programme: null,
        campaign: null,
        cohort: null,
        member: null,
        acquisition,
        branding: acquisition,
        consentContract: acquisition.consentContract,
        requiredConsentScopes: acquisition.consentContract.scopes
          .filter(({ required }) => required)
          .map(({ scope }) => scope),
        optionalConsentScopes: acquisition.consentContract.scopes
          .filter(({ required }) => !required)
          .map(({ scope }) => scope),
      };
    }

    return buildInviteResponse({
      code: normalizedCode,
      mode: "cohort_code",
      partner: cohort.Partner,
      cohort,
    });
  }

  static assertValidInvite(validation) {
    if (validation.invite.status !== "valid") {
      const statusCode =
        validation.invite.status === "already_used" ? 409 : 400;
      throw new PartnerOnboardingError(
        validation.invite.message,
        statusCode,
        validation.invite.status
      );
    }
  }

  static async claimInvite(userId, code) {
    const normalizedCode = normalizeCode(code);
    const existingMember = await CohortMember.findOne({
      where: { external_member_ref: normalizedCode },
      include: [
        {
          model: PartnerCohort,
          required: true,
          include: cohortContextIncludes(),
        },
      ],
    });

    if (existingMember) {
      const blocked = validateCohortState(
        existingMember.PartnerCohort.Partner,
        existingMember.PartnerCohort,
        "individual_invite"
      );
      if (blocked) {
        throw new PartnerOnboardingError(
          blocked.message,
          400,
          blocked.status
        );
      }

      if (!VALID_MEMBER_STATUSES.has(existingMember.membership_status)) {
        throw new PartnerOnboardingError(
          "This invite is no longer eligible for onboarding.",
          400,
          "ineligible"
        );
      }

      const member = existingMember;
      if (member.user_id && member.user_id !== userId) {
        throw new PartnerOnboardingError(
          "This invite has already been used.",
          409,
          "already_used"
        );
      }

      await member.update({
        user_id: userId,
        membership_status:
          member.membership_status === "invited"
            ? "onboarded"
            : member.membership_status,
        joined_at: member.joined_at || new Date(),
      });

      return claimedInviteResponse({
        code: normalizedCode,
        mode: "individual_invite",
        partner: member.PartnerCohort.Partner,
        cohort: member.PartnerCohort,
        member,
        userId,
      });
    }

    const validation = await this.validateInvite(normalizedCode);
    this.assertValidInvite(validation);

    const [member] = await CohortMember.findOrCreate({
      where: {
        partner_cohort_id: validation.cohort.id,
        user_id: userId,
      },
      defaults: {
        partner_cohort_id: validation.cohort.id,
        user_id: userId,
        membership_status: "onboarded",
        source_type: "system",
        joined_at: new Date(),
      },
    });

    if (member.membership_status === "invited") {
      await member.update({
        membership_status: "onboarded",
        joined_at: member.joined_at || new Date(),
      });
    }

    return {
      ...validation,
      member: toMemberResponse(member),
      consentState: await consentStateForMember(
        member,
        userId,
        validation.consentContract
      ),
    };
  }

  static async recordConsents(userId, code, payload = {}) {
    const claimed = await this.claimInvite(userId, code);
    const consentContract = claimed.consentContract;
    const consentVersion = consentContract.version;
    const consents = Array.isArray(payload.consents) ? payload.consents : [];
    const consentByScope = new Map();
    const allowedScopes = new Set(
      consentContract.scopes.map(({ scope }) => scope)
    );
    for (const consent of consents) {
      const scope = consent.scope || consent.consentScope;
      if (!allowedScopes.has(scope)) {
        throw new PartnerOnboardingError(
          `Unsupported consent scope: ${scope || "missing"}`,
          400,
          "invalid_consent"
        );
      }
      if (consentByScope.has(scope)) {
        throw new PartnerOnboardingError(
          `Duplicate consent scope: ${scope}`,
          400,
          "invalid_consent"
        );
      }
      consentByScope.set(scope, consent);
    }

    consentContract.scopes.filter(({ required }) => required).forEach(({ scope }) => {
      const consent = consentByScope.get(scope);
      if (!consent || consent.granted !== true) {
        throw new PartnerOnboardingError(
          `${scope} consent is required for partner onboarding`,
          400,
          "missing_consent"
        );
      }
    });

    const scopes = consentContract.scopes.map(({ scope }) => scope);

    const hadProcessingConsent = Boolean(
      await ConsentRecord.findOne({
        where: {
          cohort_member_id: claimed.member.id,
          user_id: userId,
          consent_scope: "hometruth_processing",
          status: ["granted", "superseded"],
        },
      })
    );

    const records = await sequelize.transaction(async (transaction) => {
      await ConsentRecord.update(
        { status: "superseded" },
        {
          where: {
            cohort_member_id: claimed.member.id,
            user_id: userId,
            consent_scope: scopes,
            status: ["granted", "withdrawn"],
          },
          transaction,
        }
      );

      const created = [];
      for (const definition of consentContract.scopes) {
        const consent = consentByScope.get(definition.scope);
        const granted = consent?.granted === true;
        const now = new Date();

        created.push(
          await ConsentRecord.create(
            {
              partner_id: claimed.partner.id,
              partner_cohort_id: claimed.cohort.id,
              cohort_member_id: claimed.member.id,
              user_id: userId,
              property_id: claimed.member.propertyId || null,
              consent_scope: definition.scope,
              consent_type: CONSENT_TYPE_BY_SCOPE[definition.scope],
              consent_version: consentVersion,
              consent_text_hash: definition.textHash,
              status: granted ? "granted" : "withdrawn",
              granted_at: granted ? now : null,
              withdrawn_at: granted ? null : now,
              recorded_at: now,
              source_type: "onboarding",
            },
            { transaction }
          )
        );
      }
      return created;
    });

    if (!hadProcessingConsent) {
      await recordPilotEventSilently({
        eventName: "signup_completed",
        userId,
        inviteCode: code,
        sourceType: "partner_onboarding",
        sourceModel: "CohortMember",
        sourceId: claimed.member.id,
        metadata: {
          inviteMode: claimed.invite.mode,
          consentVersion,
        },
      });
    }

    await recordPilotEventSilently({
      eventName: "consent_recorded",
      userId,
      inviteCode: code,
      sourceType: "partner_onboarding",
      sourceModel: "ConsentRecord",
      sourceId: records[0]?.id || null,
      metadata: {
        consentVersion,
        grantedScopes: records
          .filter((record) => record.status === "granted")
          .map((record) => record.consent_scope),
        withdrawnScopes: records
          .filter((record) => record.status === "withdrawn")
          .map((record) => record.consent_scope),
      },
    });

    return {
      ...claimed,
      consents: records.map(toConsentResponse),
      consentState: {
        version: consentVersion,
        completed: true,
        choices: Object.fromEntries(
          records.map((record) => [
            record.consent_scope,
            record.status === "granted",
          ])
        ),
      },
    };
  }

  static async attachProperty(userId, code, propertyId) {
    const claimed = await this.claimInvite(userId, code);
    if (!claimed.consentState?.completed) {
      throw new PartnerOnboardingError(
        "HomeTruth processing consent is required before connecting a property",
        400,
        "missing_consent"
      );
    }
    const property = await Property.findByPk(propertyId);
    if (!property) {
      throw new PartnerOnboardingError("Property not found", 404, "invalid");
    }

    const relationship = await PropertyPerson.findOne({
      where: {
        property_id: propertyId,
        user_id: userId,
        relationship_status: "active",
      },
    });

    if (!relationship) {
      throw new PartnerOnboardingError(
        "Property is not linked to this user",
        403,
        "ineligible"
      );
    }

    const member = await CohortMember.findByPk(claimed.member.id);
    await member.update({
      property_id: property.id,
      membership_status:
        member.membership_status === "onboarded"
          ? "active"
          : member.membership_status,
    });

    await recordPilotEventSilently({
      eventName: "property_setup_completed",
      userId,
      inviteCode: code,
      propertyId: property.id,
      sourceType: "partner_onboarding",
      sourceModel: "CohortMember",
      sourceId: member.id,
      metadata: {
        membershipStatus: member.membership_status,
      },
    });

    return {
      ...claimed,
      member: toMemberResponse(member),
    };
  }

  static async emitEvent(userId, payload = {}) {
    const eventName = payload.eventName || payload.event_name;
    if (!userId) {
      throw new PartnerOnboardingError(
        "Authenticated user is required",
        401,
        "ineligible"
      );
    }
    if (eventName !== "property_started") {
      throw new PartnerOnboardingError(
        "Unsupported partner onboarding event",
        400,
        "invalid"
      );
    }
    const inviteCode = payload.inviteCode || payload.invite_code;
    const claimed = await this.claimInvite(userId, inviteCode);
    if (!claimed.consentState?.completed) {
      throw new PartnerOnboardingError(
        "HomeTruth processing consent is required before starting a property",
        400,
        "missing_consent"
      );
    }
    const path = payload.metadata?.path;
    const safePath = new Set(["new_property", "existing_property"]).has(path)
      ? path
      : "new_property";

    const event = await PilotAnalyticsService.recordEvent({
      eventName,
      inviteCode,
      userId,
      sourceType: "partner_onboarding",
      metadata: { path: safePath },
    });

    return event;
  }

  static async recordInviteViewed(code) {
    const validation = await this.validateInvite(code);
    if (validation.invite.status === "invalid") {
      return { recorded: false, reason: "invalid_invite" };
    }
    return PilotAnalyticsService.recordEvent({
      eventName: "invite_viewed",
      inviteCode: normalizeCode(code),
      sourceType: "partner_onboarding",
      metadata: {
        inviteStatus: validation.invite.status,
        inviteMode: validation.invite.mode,
      },
    });
  }

  static async recordDailyActivity(userId) {
    return PilotAnalyticsService.recordDailyActivity(userId);
  }
}

PartnerOnboardingService.PartnerOnboardingError = PartnerOnboardingError;
PartnerOnboardingService.REQUIRED_CONSENT_SCOPES = REQUIRED_CONSENT_SCOPES;
PartnerOnboardingService.OPTIONAL_CONSENT_SCOPES = OPTIONAL_CONSENT_SCOPES;

module.exports = PartnerOnboardingService;
