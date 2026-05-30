const {
  CohortMember,
  ConsentRecord,
  Partner,
  PartnerCohort,
  Property,
  PropertyPerson,
} = require("../models");
const PilotAnalyticsService = require("./pilotAnalyticsService");

const VALID_COHORT_STATUSES = new Set(["planned", "active"]);
const VALID_MEMBER_STATUSES = new Set(["invited", "onboarded", "active"]);
const USED_MEMBER_STATUSES = new Set(["onboarded", "active", "completed"]);
const REQUIRED_CONSENT_SCOPES = [
  "hometruth_processing",
  "partner_reporting",
  "aggregate_analytics",
];
const OPTIONAL_CONSENT_SCOPES = [
  "individual_report_access",
  "partner_contact_servicing",
];
const CONSENT_TYPE_BY_SCOPE = {
  hometruth_processing: "processing",
  partner_reporting: "reporting",
  partner_contact_servicing: "contact",
  individual_report_access: "report_access",
  aggregate_analytics: "analytics",
};

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

const toBrandingResponse = (partner, cohort) => ({
  headline: `${partner.name} home pilot`,
  partnerName: partner.name,
  cohortName: cohort.name,
  productName: "HomeTruth",
});

const recordPilotEventSilently = async (payload) => {
  try {
    return await PilotAnalyticsService.recordEvent(payload);
  } catch (error) {
    console.error("Pilot event capture failed:", error.message);
    return null;
  }
};

const validateCohortState = (partner, cohort) => {
  if (!partner || partner.status !== "active") {
    return {
      status: "ineligible",
      message: "This partner pilot is not currently available.",
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

const buildInviteResponse = ({ code, mode, partner, cohort, member = null }) => {
  const blocked = validateCohortState(partner, cohort);
  if (blocked) {
    return {
      invite: {
        code,
        mode,
        status: blocked.status,
        message: blocked.message,
      },
      partner: toPartnerResponse(partner),
      cohort: toCohortResponse(cohort),
      member: toMemberResponse(member),
      branding: toBrandingResponse(partner, cohort),
      requiredConsentScopes: REQUIRED_CONSENT_SCOPES,
      optionalConsentScopes: OPTIONAL_CONSENT_SCOPES,
    };
  }

  if (member) {
    if (!VALID_MEMBER_STATUSES.has(member.membership_status)) {
      return {
        invite: {
          code,
          mode,
          status: "ineligible",
          message: "This invite is no longer eligible for onboarding.",
        },
        partner: toPartnerResponse(partner),
        cohort: toCohortResponse(cohort),
        member: toMemberResponse(member),
        branding: toBrandingResponse(partner, cohort),
        requiredConsentScopes: REQUIRED_CONSENT_SCOPES,
        optionalConsentScopes: OPTIONAL_CONSENT_SCOPES,
      };
    }

    if (member.user_id && USED_MEMBER_STATUSES.has(member.membership_status)) {
      return {
        invite: {
          code,
          mode,
          status: "already_used",
          message: "This invite has already been used.",
        },
        partner: toPartnerResponse(partner),
        cohort: toCohortResponse(cohort),
        member: null,
        branding: toBrandingResponse(partner, cohort),
        requiredConsentScopes: REQUIRED_CONSENT_SCOPES,
        optionalConsentScopes: OPTIONAL_CONSENT_SCOPES,
      };
    }
  }

  return {
    invite: {
      code,
      mode,
      status: "valid",
      message: "Invite is valid.",
    },
    partner: toPartnerResponse(partner),
    cohort: toCohortResponse(cohort),
    member: toMemberResponse(member),
    branding: toBrandingResponse(partner, cohort),
    requiredConsentScopes: REQUIRED_CONSENT_SCOPES,
    optionalConsentScopes: OPTIONAL_CONSENT_SCOPES,
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
          include: [{ model: Partner, required: true }],
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
      include: [{ model: Partner, required: true }],
    });

    if (!cohort) {
      return {
        invite: {
          code: normalizedCode,
          mode: "unknown",
          status: "invalid",
          message: "Invite code was not recognised.",
        },
        partner: null,
        cohort: null,
        member: null,
        branding: {
          headline: "HomeTruth partner pilot",
          partnerName: null,
          cohortName: null,
          productName: "HomeTruth",
        },
        requiredConsentScopes: REQUIRED_CONSENT_SCOPES,
        optionalConsentScopes: OPTIONAL_CONSENT_SCOPES,
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
          include: [{ model: Partner, required: true }],
        },
      ],
    });

    if (existingMember) {
      const blocked = validateCohortState(
        existingMember.PartnerCohort.Partner,
        existingMember.PartnerCohort
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

      return {
        invite: {
          code: normalizedCode,
          mode: "individual_invite",
          status: "valid",
          message: "Invite is valid.",
        },
        partner: toPartnerResponse(member.PartnerCohort.Partner),
        cohort: toCohortResponse(member.PartnerCohort),
        member: toMemberResponse(member),
        branding: toBrandingResponse(member.PartnerCohort.Partner, member.PartnerCohort),
        requiredConsentScopes: REQUIRED_CONSENT_SCOPES,
        optionalConsentScopes: OPTIONAL_CONSENT_SCOPES,
      };
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
    };
  }

  static async recordConsents(userId, code, payload = {}) {
    const claimed = await this.claimInvite(userId, code);
    const consentVersion = payload.consentVersion || "pilot-v1";
    const consents = Array.isArray(payload.consents) ? payload.consents : [];
    const consentByScope = new Map(
      consents.map((consent) => [consent.scope || consent.consentScope, consent])
    );

    REQUIRED_CONSENT_SCOPES.forEach((scope) => {
      const consent = consentByScope.get(scope);
      if (!consent || consent.granted !== true) {
        throw new PartnerOnboardingError(
          `${scope} consent is required for partner onboarding`,
          400,
          "missing_consent"
        );
      }
    });

    const scopes = [...REQUIRED_CONSENT_SCOPES, ...OPTIONAL_CONSENT_SCOPES];

    await ConsentRecord.update(
      { status: "superseded" },
      {
        where: {
          cohort_member_id: claimed.member.id,
          user_id: userId,
          consent_scope: scopes,
          status: "granted",
        },
      }
    );

    const records = await Promise.all(
      scopes.map((scope) => {
        const consent = consentByScope.get(scope);
        const granted = consent?.granted === true;
        const now = new Date();

        return ConsentRecord.create({
          partner_id: claimed.partner.id,
          partner_cohort_id: claimed.cohort.id,
          cohort_member_id: claimed.member.id,
          user_id: userId,
          property_id: claimed.member.propertyId || null,
          consent_scope: scope,
          consent_type: CONSENT_TYPE_BY_SCOPE[scope],
          consent_version: consent?.version || consentVersion,
          consent_text_hash: consent?.textHash || null,
          status: granted ? "granted" : "withdrawn",
          granted_at: granted ? now : null,
          withdrawn_at: granted ? null : now,
          recorded_at: now,
          source_type: "onboarding",
        });
      })
    );

    await recordPilotEventSilently({
      eventName: "signup_completed",
      userId,
      partnerId: claimed.partner.id,
      partnerCohortId: claimed.cohort.id,
      cohortMemberId: claimed.member.id,
      partnerContextAllowed: true,
      sourceType: "partner_onboarding",
      sourceModel: "CohortMember",
      sourceId: claimed.member.id,
      metadata: {
        inviteMode: claimed.invite.mode,
        consentVersion,
      },
    });

    await recordPilotEventSilently({
      eventName: "consent_recorded",
      userId,
      partnerId: claimed.partner.id,
      partnerCohortId: claimed.cohort.id,
      cohortMemberId: claimed.member.id,
      partnerContextAllowed: true,
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
    };
  }

  static async attachProperty(userId, code, propertyId) {
    const claimed = await this.claimInvite(userId, code);
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
    if (!eventName) {
      throw new PartnerOnboardingError("eventName is required", 400, "invalid");
    }

    const event = await PilotAnalyticsService.recordEvent({
      eventName,
      inviteCode: payload.inviteCode || payload.invite_code || null,
      userId: userId || null,
      propertyId: payload.propertyId || payload.property_id || null,
      sourceType: "partner_onboarding",
      metadata: payload.metadata || {},
    });

    return event;
  }
}

PartnerOnboardingService.PartnerOnboardingError = PartnerOnboardingError;
PartnerOnboardingService.REQUIRED_CONSENT_SCOPES = REQUIRED_CONSENT_SCOPES;
PartnerOnboardingService.OPTIONAL_CONSENT_SCOPES = OPTIONAL_CONSENT_SCOPES;

module.exports = PartnerOnboardingService;
