const { Op, fn, col, where: sequelizeWhere } = require("sequelize");
const {
  CohortMember,
  ConsentRecord,
  Partner,
  PartnerCohort,
  PilotEvent,
} = require("../models");

const EVENT_NAME_ALIASES = {
  consent_granted: "consent_recorded",
  property_completed: "property_setup_completed",
};

const EVENT_CATEGORY_BY_NAME = {
  invite_viewed: "onboarding",
  signup_completed: "onboarding",
  consent_recorded: "consent",
  property_started: "property",
  property_setup_completed: "property",
  document_linked: "document",
  fact_created: "fact",
  tasks_generated: "task",
  task_completed: "task",
  task_dismissed: "task",
  task_not_relevant: "task",
  property_chat_question: "system",
  pilot_daily_activity: "system",
  user_feedback_submitted: "feedback",
};

const VALID_PERIODS = new Set(["7d", "30d", "90d", "all"]);
const AGGREGATE_SCOPE = "aggregate_analytics";

class PilotAnalyticsError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "PilotAnalyticsError";
    this.statusCode = statusCode;
  }
}

const getDateRange = (period = "30d") => {
  const normalizedPeriod = VALID_PERIODS.has(period) ? period : "30d";
  if (normalizedPeriod === "all") return { start: null, end: new Date() };

  const days = { "7d": 7, "30d": 30, "90d": 90 }[normalizedPeriod];
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start, end: new Date() };
};

const normalizeEventName = (eventName) => {
  if (!eventName || typeof eventName !== "string" || !eventName.trim()) {
    throw new PilotAnalyticsError("eventName is required");
  }
  const normalized = eventName.trim();
  return EVENT_NAME_ALIASES[normalized] || normalized;
};

const sanitizeMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const sanitized = { ...metadata };
  delete sanitized.email;
  delete sanitized.name;
  delete sanitized.address;
  delete sanitized.documentName;
  delete sanitized.rawFactValue;
  delete sanitized.comment;
  delete sanitized.feedbackText;
  return sanitized;
};

const toIntegerOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toEventResponse = (event) => ({
  id: event.id,
  eventName: event.event_name,
  eventCategory: event.event_category,
  partnerId: event.partner_id,
  partnerCohortId: event.partner_cohort_id,
  cohortMemberId: event.cohort_member_id,
  userId: event.user_id,
  propertyId: event.property_id,
  sourceType: event.source_type,
  sourceModel: event.source_model,
  sourceId: event.source_id,
  consentScope: event.consent_scope,
  partnerContextAllowed: event.partner_context_allowed,
  metadata: event.metadata,
  occurredAt: event.occurred_at,
  activityDate: event.activity_date,
  createdAt: event.createdAt,
});

const findInviteContext = async (inviteCode, options = {}) => {
  if (!inviteCode) return null;

  const member = await CohortMember.findOne({
    where: { external_member_ref: inviteCode },
    include: [
      {
        model: PartnerCohort,
        required: true,
        include: [{ model: Partner, required: true }],
      },
    ],
    transaction: options.transaction,
  });

  if (member) {
    return {
      partner: member.PartnerCohort.Partner,
      cohort: member.PartnerCohort,
      member,
    };
  }

  const cohort = await PartnerCohort.findOne({
    where: { cohort_key: inviteCode },
    include: [{ model: Partner, required: true }],
    transaction: options.transaction,
  });

  if (!cohort) return null;
  return {
    partner: cohort.Partner,
    cohort,
    member: null,
  };
};

const findUserCohortContext = async (userId, propertyId, options = {}) => {
  if (!userId && !propertyId) return null;

  const where = {};
  if (userId) where.user_id = userId;
  if (propertyId) where.property_id = propertyId;

  let member = await CohortMember.findOne({
    where,
    include: [
      {
        model: PartnerCohort,
        required: true,
        include: [{ model: Partner, required: true }],
      },
    ],
    order: [["updatedAt", "DESC"]],
    transaction: options.transaction,
  });

  if (!member && userId && propertyId) {
    member = await CohortMember.findOne({
      where: { user_id: userId },
      include: [
        {
          model: PartnerCohort,
          required: true,
          include: [{ model: Partner, required: true }],
        },
      ],
      order: [["updatedAt", "DESC"]],
      transaction: options.transaction,
    });
  }

  if (!member) return null;
  return {
    partner: member.PartnerCohort.Partner,
    cohort: member.PartnerCohort,
    member,
  };
};

const hasAggregateConsent = async (context, userId, options = {}) => {
  if (!context?.member || !userId) return false;

  const consent = await ConsentRecord.findOne({
    where: {
      consent_scope: AGGREGATE_SCOPE,
      status: "granted",
      user_id: userId,
      partner_cohort_id: context.cohort.id,
      cohort_member_id: context.member.id,
    },
    transaction: options.transaction,
  });

  return Boolean(consent);
};

const resolveContext = async (payload, options = {}) => {
  if (payload.partnerContextAllowed === true) {
    return {
      partnerId: toIntegerOrNull(payload.partnerId || payload.partner_id),
      partnerCohortId: toIntegerOrNull(
        payload.partnerCohortId || payload.partner_cohort_id
      ),
      cohortMemberId: toIntegerOrNull(
        payload.cohortMemberId || payload.cohort_member_id
      ),
      consentScope: payload.consentScope || AGGREGATE_SCOPE,
      partnerContextAllowed: true,
    };
  }

  const userId = toIntegerOrNull(payload.userId || payload.user_id);
  const propertyId = toIntegerOrNull(payload.propertyId || payload.property_id);
  const inviteCode = payload.inviteCode || payload.invite_code || null;
  const eventName = normalizeEventName(payload.eventName || payload.event_name);

  if (eventName === "invite_viewed" && inviteCode) {
    const inviteContext = await findInviteContext(inviteCode, options);
    if (!inviteContext) {
      return {
        partnerId: null,
        partnerCohortId: null,
        cohortMemberId: null,
        consentScope: null,
        partnerContextAllowed: false,
      };
    }

    return {
      partnerId: inviteContext.partner.id,
      partnerCohortId: inviteContext.cohort.id,
      cohortMemberId: null,
      consentScope: "cohort_entry_no_personal_data",
      partnerContextAllowed: true,
    };
  }

  const context =
    (inviteCode && (await findInviteContext(inviteCode, options))) ||
    (await findUserCohortContext(userId, propertyId, options));

  if (!context) {
    return {
      partnerId: null,
      partnerCohortId: null,
      cohortMemberId: null,
      consentScope: null,
      partnerContextAllowed: false,
    };
  }

  const aggregateAllowed = await hasAggregateConsent(context, userId, options);
  if (!aggregateAllowed) {
    return {
      partnerId: null,
      partnerCohortId: null,
      cohortMemberId: null,
      consentScope: null,
      partnerContextAllowed: false,
    };
  }

  return {
    partnerId: context.partner.id,
    partnerCohortId: context.cohort.id,
    cohortMemberId: context.member?.id || null,
    consentScope: AGGREGATE_SCOPE,
    partnerContextAllowed: true,
  };
};

const countEvents = async (where) => {
  const rows = await PilotEvent.findAll({
    attributes: ["event_name", [fn("COUNT", col("id")), "count"]],
    where,
    group: ["event_name"],
    raw: true,
  });

  return rows.reduce((counts, row) => {
    counts[row.event_name] = Number.parseInt(row.count, 10);
    return counts;
  }, {});
};

const countDistinctParticipants = async (where) =>
  PilotEvent.count({
    where,
    distinct: true,
    col: "cohort_member_id",
  });

const countRepeatActiveMembers = async (where) => {
  const rows = await PilotEvent.findAll({
    attributes: ["cohort_member_id"],
    where: {
      ...where,
      event_name: "pilot_daily_activity",
      activity_date: { [Op.ne]: null },
    },
    group: ["cohort_member_id"],
    having: sequelizeWhere(
      fn("COUNT", fn("DISTINCT", col("activity_date"))),
      { [Op.gte]: 2 }
    ),
    raw: true,
  });

  return rows.length;
};

const utcActivityDate = (date = new Date()) => date.toISOString().slice(0, 10);

const pct = (numerator, denominator) => {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
};

const buildReadiness = (cohort, metrics) => {
  const items = [
    {
      key: "event_pipeline",
      label: "Pilot event pipeline",
      status: metrics.totalEvents > 0 ? "ready" : "needs_data",
      note:
        metrics.totalEvents > 0
          ? "Durable pilot events are being recorded."
          : "No cohort events recorded yet.",
    },
    {
      key: "consent_boundary",
      label: "Consent-bound aggregate reporting",
      status: "ready",
      note: "Report returns cohort aggregates only; no personal rows are exposed.",
    },
    {
      key: "onboarding_monitoring",
      label: "Failed onboarding monitoring",
      status: metrics.inviteViewed > 0 ? "ready" : "needs_data",
      note:
        metrics.inviteViewed > 0
          ? "Invite activity is visible in aggregate."
          : "Invite traffic must be verified before launch.",
    },
    {
      key: "data_deletion",
      label: "Data deletion and withdrawal path",
      status: "blocked",
      note: "Operational owner and withdrawal runbook still need confirmation.",
    },
    {
      key: "incident_response",
      label: "Incident and support escalation",
      status: "blocked",
      note: "Support owner and escalation contact must be assigned before launch.",
    },
    {
      key: "notification_scope",
      label: "Notification scope",
      status: "ready",
      note: "External push notifications are excluded from the V1 pilot.",
    },
  ];

  const blockers = items.filter((item) => item.status === "blocked");

  return {
    cohortId: cohort.id,
    recommendation: blockers.length ? "no_go" : "go_with_monitoring",
    blockers: blockers.map((item) => item.label),
    items,
  };
};

class PilotAnalyticsService {
  static async recordEvent(payload = {}, options = {}) {
    const eventName = normalizeEventName(payload.eventName || payload.event_name);
    const userId = toIntegerOrNull(payload.userId || payload.user_id);
    const propertyId = toIntegerOrNull(payload.propertyId || payload.property_id);
    const eventCategory =
      payload.eventCategory ||
      payload.event_category ||
      EVENT_CATEGORY_BY_NAME[eventName] ||
      "system";

    const context = await resolveContext(
      {
        ...payload,
        eventName,
        userId,
        propertyId,
      },
      options
    );

    const event = await PilotEvent.create(
      {
        event_name: eventName,
        event_category: eventCategory,
        partner_id: context.partnerId,
        partner_cohort_id: context.partnerCohortId,
        cohort_member_id: context.cohortMemberId,
        user_id: userId,
        property_id: propertyId,
        source_type: payload.sourceType || payload.source_type || "system",
        source_model: payload.sourceModel || payload.source_model || null,
        source_id: toIntegerOrNull(payload.sourceId || payload.source_id),
        consent_scope: context.consentScope,
        partner_context_allowed: context.partnerContextAllowed,
        metadata: sanitizeMetadata(payload.metadata),
        activity_date: payload.activityDate || payload.activity_date || null,
        occurred_at: payload.occurredAt || payload.occurred_at || new Date(),
      },
      { transaction: options.transaction }
    );

    return toEventResponse(event);
  }

  static async recordFeedback(userId, payload = {}) {
    const rating = payload.rating === undefined ? null : Number(payload.rating);
    if (rating !== null && (Number.isNaN(rating) || rating < 1 || rating > 5)) {
      throw new PilotAnalyticsError("rating must be between 1 and 5");
    }

    const comment = payload.comment || payload.feedbackText || "";
    return this.recordEvent({
      eventName: "user_feedback_submitted",
      userId,
      propertyId: payload.propertyId || payload.property_id || null,
      sourceType: "feedback",
      metadata: {
        rating,
        feedbackType: payload.feedbackType || payload.feedback_type || "general",
        route: payload.route || null,
        hasComment: Boolean(comment),
        commentLength: comment.length,
      },
    });
  }

  static async recordDailyActivity(userId, options = {}) {
    const normalizedUserId = toIntegerOrNull(userId);
    if (!normalizedUserId) {
      throw new PilotAnalyticsError("Authenticated user is required", 401);
    }

    const context = await resolveContext(
      { eventName: "pilot_daily_activity", userId: normalizedUserId },
      options
    );
    if (!context.partnerContextAllowed || !context.cohortMemberId) {
      return { recorded: false, reason: "no_eligible_cohort" };
    }

    const activityDate = utcActivityDate();
    const eventWhere = {
      event_name: "pilot_daily_activity",
      partner_cohort_id: context.partnerCohortId,
      cohort_member_id: context.cohortMemberId,
      user_id: normalizedUserId,
      activity_date: activityDate,
    };
    const existing = await PilotEvent.findOne({
      where: eventWhere,
      transaction: options.transaction,
    });
    if (existing) {
      return { recorded: false, deduplicated: true, event: toEventResponse(existing) };
    }

    try {
      const event = await this.recordEvent(
        {
          eventName: "pilot_daily_activity",
          userId: normalizedUserId,
          partnerContextAllowed: true,
          partnerId: context.partnerId,
          partnerCohortId: context.partnerCohortId,
          cohortMemberId: context.cohortMemberId,
          consentScope: AGGREGATE_SCOPE,
          sourceType: "system",
          sourceModel: "PilotActivity",
          activityDate,
          metadata: {},
        },
        options
      );
      return { recorded: true, deduplicated: false, event };
    } catch (error) {
      if (error.name !== "SequelizeUniqueConstraintError") throw error;

      const duplicate = await PilotEvent.findOne({
        where: eventWhere,
        transaction: options.transaction,
      });
      if (!duplicate) throw error;
      return { recorded: false, deduplicated: true, event: toEventResponse(duplicate) };
    }
  }

  static async getCohortReport(filters = {}) {
    const { start } = getDateRange(filters.period);
    const eventWhere = {
      partner_context_allowed: true,
    };
    if (start) eventWhere.occurred_at = { [Op.gte]: start };

    const cohortWhere = {};
    if (filters.partnerId) cohortWhere.partner_id = filters.partnerId;
    if (filters.cohortId) cohortWhere.id = filters.cohortId;

    const cohorts = await PartnerCohort.findAll({
      where: cohortWhere,
      include: [{ model: Partner, required: true }],
      order: [["updatedAt", "DESC"]],
    });

    const reports = [];

    for (const cohort of cohorts) {
      const scopedEventWhere = {
        ...eventWhere,
        partner_cohort_id: cohort.id,
      };
      const eventCounts = await countEvents(scopedEventWhere);
      const [
        totalEvents,
        signupCompletedMembers,
        consentRecordedMembers,
        propertySetupCompletedMembers,
        documentLinkedMembers,
        tasksGeneratedMembers,
        taskActionedMembers,
        propertyChatQuestionedMembers,
        repeatActiveMembers,
      ] = await Promise.all([
        PilotEvent.count({ where: scopedEventWhere }),
        countDistinctParticipants({
          ...scopedEventWhere,
          event_name: "signup_completed",
        }),
        countDistinctParticipants({
          ...scopedEventWhere,
          event_name: "consent_recorded",
        }),
        countDistinctParticipants({
          ...scopedEventWhere,
          event_name: "property_setup_completed",
        }),
        countDistinctParticipants({
          ...scopedEventWhere,
          event_name: "document_linked",
        }),
        countDistinctParticipants({
          ...scopedEventWhere,
          event_name: "tasks_generated",
        }),
        countDistinctParticipants({
          ...scopedEventWhere,
          event_name: {
            [Op.in]: ["task_completed", "task_dismissed", "task_not_relevant"],
          },
        }),
        countDistinctParticipants({
          ...scopedEventWhere,
          event_name: "property_chat_question",
        }),
        countRepeatActiveMembers(scopedEventWhere),
      ]);

      const [
        invitedMembers,
        onboardedMembers,
        activeMembers,
        propertiesLinked,
        aggregateConsentGranted,
      ] = await Promise.all([
        CohortMember.count({ where: { partner_cohort_id: cohort.id } }),
        CohortMember.count({
          where: {
            partner_cohort_id: cohort.id,
            membership_status: { [Op.in]: ["onboarded", "active", "completed"] },
          },
        }),
        CohortMember.count({
          where: {
            partner_cohort_id: cohort.id,
            membership_status: { [Op.in]: ["active", "completed"] },
          },
        }),
        CohortMember.count({
          where: {
            partner_cohort_id: cohort.id,
            property_id: { [Op.ne]: null },
          },
        }),
        ConsentRecord.count({
          where: {
            partner_cohort_id: cohort.id,
            consent_scope: AGGREGATE_SCOPE,
            status: "granted",
          },
        }),
      ]);

      const feedbackEvents = await PilotEvent.findAll({
        where: {
          ...scopedEventWhere,
          event_name: "user_feedback_submitted",
        },
        attributes: ["metadata"],
        raw: true,
      });
      const feedbackRatings = feedbackEvents
        .map((event) => Number(event.metadata?.rating))
        .filter((rating) => Number.isFinite(rating));
      const averageFeedbackRating = feedbackRatings.length
        ? Number(
            (
              feedbackRatings.reduce((sum, rating) => sum + rating, 0) /
              feedbackRatings.length
            ).toFixed(1)
          )
        : null;

      const metrics = {
        targetSize: cohort.target_size,
        invitedMembers,
        onboardedMembers,
        activeMembers,
        propertiesLinked,
        aggregateConsentGranted,
        totalEvents,
        inviteViewed: eventCounts.invite_viewed || 0,
        signupCompleted: eventCounts.signup_completed || 0,
        consentRecorded: eventCounts.consent_recorded || 0,
        propertySetupCompleted: eventCounts.property_setup_completed || 0,
        documentLinked: eventCounts.document_linked || 0,
        factCreated: eventCounts.fact_created || 0,
        tasksGenerated: eventCounts.tasks_generated || 0,
        taskCompleted: eventCounts.task_completed || 0,
        taskDismissed: eventCounts.task_dismissed || 0,
        taskNotRelevant: eventCounts.task_not_relevant || 0,
        feedbackSubmitted: eventCounts.user_feedback_submitted || 0,
        averageFeedbackRating,
        signupCompletedMembers,
        consentRecordedMembers,
        propertySetupCompletedMembers,
        documentLinkedMembers,
        tasksGeneratedMembers,
        taskActionedMembers,
        propertyChatQuestionedMembers,
        repeatActiveMembers,
      };

      metrics.activationRate = pct(metrics.signupCompletedMembers, invitedMembers);
      metrics.propertySetupCompletionRate = pct(
        metrics.propertySetupCompletedMembers,
        metrics.signupCompletedMembers
      );
      metrics.consentRate = pct(
        metrics.consentRecordedMembers,
        metrics.signupCompletedMembers
      );
      metrics.documentLinksPerActivatedMember = metrics.signupCompletedMembers
        ? Number(
            (
              metrics.documentLinked / metrics.signupCompletedMembers
            ).toFixed(1)
          )
        : 0;
      metrics.taskCompletionRate = pct(
        metrics.taskCompleted,
        metrics.taskCompleted + metrics.taskDismissed + metrics.taskNotRelevant
      );
      metrics.taskActionEngagementRate = pct(
        metrics.taskActionedMembers,
        metrics.signupCompletedMembers
      );
      metrics.propertyChatUsageRate = pct(
        metrics.propertyChatQuestionedMembers,
        metrics.signupCompletedMembers
      );
      metrics.repeatUseRate = pct(
        metrics.repeatActiveMembers,
        metrics.signupCompletedMembers
      );

      const dropOff = {
        inviteToSignup: Math.max(0, invitedMembers - metrics.signupCompletedMembers),
        signupToConsent: Math.max(
          0,
          metrics.signupCompletedMembers - metrics.consentRecordedMembers
        ),
        consentToProperty: Math.max(
          0,
          metrics.consentRecordedMembers - metrics.propertySetupCompletedMembers
        ),
        propertyToDocument: Math.max(
          0,
          metrics.propertySetupCompletedMembers - metrics.documentLinkedMembers
        ),
      };

      reports.push({
        cohort: {
          id: cohort.id,
          name: cohort.name,
          cohortKey: cohort.cohort_key,
          status: cohort.status,
          targetSize: cohort.target_size,
          startDate: cohort.start_date,
          endDate: cohort.end_date,
        },
        partner: {
          id: cohort.Partner.id,
          name: cohort.Partner.name,
          partnerType: cohort.Partner.partner_type,
          reportingMode: cohort.Partner.reporting_mode,
        },
        metrics,
        eventCounts,
        metricCoverage: {
          inviteToSignupActivation: "measured",
          propertySetupCompletion: "measured",
          documentsLinkedPerActivatedMember: "measured",
          taskGeneration: "measured",
          taskActionEngagement: "measured",
          propertyAwareChatUsage: "measured",
          repeatUse: "measured",
          feedbackRating: "measured",
        },
        dropOff,
        readiness: buildReadiness(cohort, metrics),
      });
    }

    return {
      period: VALID_PERIODS.has(filters.period) ? filters.period : "30d",
      generatedAt: new Date().toISOString(),
      privacyBoundary:
        "Cohort aggregate metrics only. No user, member, property, document or raw fact rows are returned.",
      reports,
    };
  }
}

PilotAnalyticsService.PilotAnalyticsError = PilotAnalyticsError;
PilotAnalyticsService.EVENT_CATEGORY_BY_NAME = EVENT_CATEGORY_BY_NAME;

module.exports = PilotAnalyticsService;
