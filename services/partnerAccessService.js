const sequelize = require("../config/database");
const {
  Partner,
  PartnerAccessAuditEvent,
  PartnerProgramme,
  PartnerProgrammeAccess,
  PartnerProgrammeAuditEvent,
  User,
} = require("../models");

const ROLES = new Set([
  "sponsor",
  "programme_manager",
  "analyst",
  "privacy_auditor",
]);

const ROLE_CAPABILITIES = Object.freeze({
  sponsor: Object.freeze(["programme:view", "report:view", "report:export"]),
  programme_manager: Object.freeze([
    "programme:view",
    "audit:view",
    "report:view",
    "report:export",
  ]),
  analyst: Object.freeze(["programme:view", "report:view", "report:export"]),
  privacy_auditor: Object.freeze([
    "programme:view",
    "audit:view",
    "report:definitions:view",
  ]),
});

const IMPLEMENTED_CAPABILITIES = new Set(["programme:view", "audit:view"]);
const INDIVIDUAL_RESOURCE_TYPES = new Set([
  "homeowners",
  "members",
  "properties",
  "documents",
  "tasks",
  "profiles",
  "chats",
  "events",
]);

class PartnerAccessError extends Error {
  constructor(message, statusCode = 400, reasonCode = "invalid_request") {
    super(message);
    this.name = "PartnerAccessError";
    this.statusCode = statusCode;
    this.reasonCode = reasonCode;
  }
}

const value = (record, key) => record?.[key] ?? record?.dataValues?.[key];

const positiveInteger = (input, label) => {
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new PartnerAccessError(`${label} must be a positive integer`);
  }
  return parsed;
};

const normalizeRole = (input) => {
  if (!ROLES.has(input)) {
    throw new PartnerAccessError(
      "role must be sponsor, programme_manager, analyst or privacy_auditor"
    );
  }
  return input;
};

const normalizeEmail = (input) => {
  if (typeof input !== "string" || !input.trim()) {
    throw new PartnerAccessError("userEmail is required");
  }
  const email = input.trim().toLowerCase();
  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PartnerAccessError("userEmail must be a valid email address");
  }
  return email;
};

const evaluateAccess = ({
  accessStatus,
  role,
  partnerStatus,
  programmeStatus,
  capability,
  accessPartnerId,
  programmePartnerId,
}) => {
  if (accessStatus !== "active") {
    return { allowed: false, reasonCode: "assignment_inactive" };
  }
  if (!ROLE_CAPABILITIES[role]?.includes(capability)) {
    return { allowed: false, reasonCode: "role_not_permitted" };
  }
  if (
    accessPartnerId !== undefined &&
    programmePartnerId !== undefined &&
    Number(accessPartnerId) !== Number(programmePartnerId)
  ) {
    return { allowed: false, reasonCode: "scope_mismatch" };
  }
  if (capability === "audit:view") return { allowed: true, reasonCode: null };
  if (partnerStatus !== "active") {
    return { allowed: false, reasonCode: "partner_inactive" };
  }
  if (programmeStatus !== "active") {
    return { allowed: false, reasonCode: "programme_inactive" };
  }
  return { allowed: true, reasonCode: null };
};

const currentCapabilities = (access) => {
  const role = value(access, "access_role");
  const partner = access.Partner;
  const programme = access.PartnerProgramme;
  return (ROLE_CAPABILITIES[role] || []).filter(
    (capability) =>
      IMPLEMENTED_CAPABILITIES.has(capability) &&
      evaluateAccess({
        accessStatus: value(access, "status"),
        role,
        partnerStatus: value(partner, "status"),
        programmeStatus: value(programme, "status"),
        capability,
        accessPartnerId: value(access, "partner_id"),
        programmePartnerId: value(programme, "partner_id"),
      }).allowed
  );
};

const accessInclude = [
  {
    model: Partner,
    required: true,
    attributes: ["id", "name", "partner_type", "status", "reporting_mode"],
  },
  {
    model: PartnerProgramme,
    required: true,
    attributes: [
      "id",
      "partner_id",
      "programme_key",
      "name",
      "status",
      "start_date",
      "end_date",
    ],
  },
];

const toPartnerProgrammeResponse = (access) => {
  const programme = access.PartnerProgramme;
  const partner = access.Partner;
  return {
    role: value(access, "access_role"),
    assignmentStatus: value(access, "status"),
    capabilities: currentCapabilities(access),
    programme: {
      id: value(programme, "id"),
      programmeKey: value(programme, "programme_key"),
      name: value(programme, "name"),
      status: value(programme, "status"),
      startDate: value(programme, "start_date"),
      endDate: value(programme, "end_date"),
    },
    partner: {
      id: value(partner, "id"),
      name: value(partner, "name"),
      partnerType: value(partner, "partner_type"),
      status: value(partner, "status"),
      reportingMode: value(partner, "reporting_mode"),
    },
    privacyBoundary:
      "Programme-scoped aggregate access only. No homeowner, property, document, task, profile, chat or behavioural-event rows are available.",
  };
};

const toAdminAssignmentResponse = (access) => ({
  id: value(access, "id"),
  role: value(access, "access_role"),
  status: value(access, "status"),
  grantedAt: value(access, "granted_at"),
  revokedAt: value(access, "revoked_at"),
  user: access.user
    ? {
        id: value(access.user, "id"),
        email: value(access.user, "email"),
        firstName: value(access.user, "first_name"),
        lastName: value(access.user, "last_name"),
        verified: Boolean(value(access.user, "is_verified")),
      }
    : null,
});

const safeAuditDetails = (details = {}) => {
  const allowedKeys = new Set([
    "role",
    "previousRole",
    "programmeStatus",
    "partnerType",
    "resourceClass",
  ]);
  return Object.fromEntries(
    Object.entries(details).filter(
      ([key, entry]) => allowedKeys.has(key) && ["string", "boolean"].includes(typeof entry)
    )
  );
};

const recordAudit = async (payload, options = {}) =>
  PartnerAccessAuditEvent.create(
    {
      partner_id: payload.partnerId,
      partner_programme_id: payload.programmeId,
      partner_programme_access_id: payload.accessId || null,
      actor_user_id: payload.actorUserId || null,
      subject_user_id: payload.subjectUserId || null,
      event_type: payload.eventType,
      action: payload.action,
      resource_type: payload.resourceType,
      outcome: payload.outcome,
      reason_code: payload.reasonCode || null,
      details: safeAuditDetails(payload.details),
      occurred_at: new Date(),
    },
    { transaction: options.transaction }
  );

const loadProgrammeForAdmin = async (programmeId, options = {}) => {
  const id = positiveInteger(programmeId, "programmeId");
  const programme = await PartnerProgramme.findByPk(id, {
    include: [{ model: Partner, required: true }],
    transaction: options.transaction,
    lock: options.lock,
  });
  if (!programme) throw new PartnerAccessError("Partner programme not found", 404);
  return programme;
};

const loadAccess = async (userId, programmeId, options = {}) => {
  const normalizedUserId = positiveInteger(userId, "userId");
  const normalizedProgrammeId = positiveInteger(programmeId, "programmeId");
  return PartnerProgrammeAccess.findOne({
    where: {
      user_id: normalizedUserId,
      partner_programme_id: normalizedProgrammeId,
    },
    include: accessInclude,
    transaction: options.transaction,
    lock: options.lock,
  });
};

const deniedError = () =>
  new PartnerAccessError(
    "Partner programme access is not permitted",
    403,
    "partner_access_denied"
  );

class PartnerAccessService {
  static async listAssignments(programmeId) {
    const programme = await loadProgrammeForAdmin(programmeId);
    const assignments = await PartnerProgrammeAccess.findAll({
      where: { partner_programme_id: value(programme, "id") },
      include: [
        {
          model: User,
          as: "user",
          required: false,
          attributes: ["id", "email", "first_name", "last_name", "is_verified"],
        },
      ],
      order: [["updated_at", "DESC"]],
    });
    return assignments.map(toAdminAssignmentResponse);
  }

  static async grantAccess(programmeId, payload = {}, actorUserId) {
    const actorId = positiveInteger(actorUserId, "actorUserId");
    const role = normalizeRole(payload.role);
    const email = normalizeEmail(payload.userEmail);

    let accessId;
    try {
      accessId = await sequelize.transaction(async (transaction) => {
        const programme = await loadProgrammeForAdmin(programmeId, {
          transaction,
          lock: true,
        });
        const users = await User.findAll({
          where: { email },
          transaction,
          limit: 2,
        });
        if (users.length !== 1 || !value(users[0], "is_verified")) {
          throw new PartnerAccessError(
            "Access requires one verified HomeTruth user matching that email",
            users.length > 1 ? 409 : 400
          );
        }
        const subject = users[0];
        let access = await PartnerProgrammeAccess.findOne({
          where: {
            partner_programme_id: value(programme, "id"),
            user_id: value(subject, "id"),
          },
          transaction,
          lock: true,
        });
        if (access && value(access, "status") === "active") {
          throw new PartnerAccessError(
            "That user already has active access to this programme",
            409
          );
        }
        if (access) {
          await access.update(
            {
              partner_id: value(programme, "partner_id"),
              access_role: role,
              status: "active",
              granted_by_user_id: actorId,
              revoked_by_user_id: null,
              granted_at: new Date(),
              revoked_at: null,
            },
            { transaction }
          );
        } else {
          access = await PartnerProgrammeAccess.create(
            {
              partner_id: value(programme, "partner_id"),
              partner_programme_id: value(programme, "id"),
              user_id: value(subject, "id"),
              access_role: role,
              status: "active",
              granted_by_user_id: actorId,
              granted_at: new Date(),
            },
            { transaction }
          );
        }
        await recordAudit(
          {
            partnerId: value(programme, "partner_id"),
            programmeId: value(programme, "id"),
            accessId: value(access, "id"),
            actorUserId: actorId,
            subjectUserId: value(subject, "id"),
            eventType: "access_granted",
            action: "access:grant",
            resourceType: "partner_programme_access",
            outcome: "allowed",
            details: { role, programmeStatus: value(programme, "status") },
          },
          { transaction }
        );
        return value(access, "id");
      });
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        throw new PartnerAccessError(
          "That user already has active access to this programme",
          409
        );
      }
      throw error;
    }
    return this.getAssignment(programmeId, accessId);
  }

  static async getAssignment(programmeId, accessId) {
    const programme = await loadProgrammeForAdmin(programmeId);
    const access = await PartnerProgrammeAccess.findOne({
      where: {
        id: positiveInteger(accessId, "accessId"),
        partner_programme_id: value(programme, "id"),
      },
      include: [
        {
          model: User,
          as: "user",
          required: false,
          attributes: ["id", "email", "first_name", "last_name", "is_verified"],
        },
      ],
    });
    if (!access) throw new PartnerAccessError("Access assignment not found", 404);
    return toAdminAssignmentResponse(access);
  }

  static async changeRole(programmeId, accessId, roleInput, actorUserId) {
    const actorId = positiveInteger(actorUserId, "actorUserId");
    const role = normalizeRole(roleInput);
    await sequelize.transaction(async (transaction) => {
      const programme = await loadProgrammeForAdmin(programmeId, {
        transaction,
        lock: true,
      });
      const access = await PartnerProgrammeAccess.findOne({
        where: {
          id: positiveInteger(accessId, "accessId"),
          partner_programme_id: value(programme, "id"),
        },
        transaction,
        lock: true,
      });
      if (!access || value(access, "status") !== "active") {
        throw new PartnerAccessError("Active access assignment not found", 404);
      }
      const previousRole = value(access, "access_role");
      if (previousRole === role) {
        throw new PartnerAccessError("The access assignment already has that role", 409);
      }
      await access.update({ access_role: role }, { transaction });
      await recordAudit(
        {
          partnerId: value(programme, "partner_id"),
          programmeId: value(programme, "id"),
          accessId: value(access, "id"),
          actorUserId: actorId,
          subjectUserId: value(access, "user_id"),
          eventType: "access_role_changed",
          action: "access:change_role",
          resourceType: "partner_programme_access",
          outcome: "allowed",
          details: { previousRole, role },
        },
        { transaction }
      );
    });
    return this.getAssignment(programmeId, accessId);
  }

  static async revokeAccess(programmeId, accessId, actorUserId) {
    const actorId = positiveInteger(actorUserId, "actorUserId");
    await sequelize.transaction(async (transaction) => {
      const programme = await loadProgrammeForAdmin(programmeId, {
        transaction,
        lock: true,
      });
      const access = await PartnerProgrammeAccess.findOne({
        where: {
          id: positiveInteger(accessId, "accessId"),
          partner_programme_id: value(programme, "id"),
        },
        transaction,
        lock: true,
      });
      if (!access || value(access, "status") !== "active") {
        throw new PartnerAccessError("Active access assignment not found", 404);
      }
      await access.update(
        { status: "revoked", revoked_by_user_id: actorId, revoked_at: new Date() },
        { transaction }
      );
      await recordAudit(
        {
          partnerId: value(programme, "partner_id"),
          programmeId: value(programme, "id"),
          accessId: value(access, "id"),
          actorUserId: actorId,
          subjectUserId: value(access, "user_id"),
          eventType: "access_revoked",
          action: "access:revoke",
          resourceType: "partner_programme_access",
          outcome: "allowed",
          details: { role: value(access, "access_role") },
        },
        { transaction }
      );
    });
    return this.getAssignment(programmeId, accessId);
  }

  static async listMyProgrammes(userId) {
    const assignments = await PartnerProgrammeAccess.findAll({
      where: { user_id: positiveInteger(userId, "userId"), status: "active" },
      include: accessInclude,
      order: [[PartnerProgramme, "name", "ASC"]],
    });
    const scopedAssignments = assignments
      .filter(
        (access) =>
          Number(value(access, "partner_id")) ===
          Number(value(access.PartnerProgramme, "partner_id"))
      );
    await Promise.all(
      scopedAssignments.map((access) =>
        recordAudit({
          partnerId: value(access, "partner_id"),
          programmeId: value(access, "partner_programme_id"),
          accessId: value(access, "id"),
          actorUserId: positiveInteger(userId, "userId"),
          subjectUserId: value(access, "user_id"),
          eventType: "programme_viewed",
          action: "programme:list_summary",
          resourceType: "partner_programme",
          outcome: "allowed",
          details: {
            role: value(access, "access_role"),
            partnerType: value(access.Partner, "partner_type"),
            programmeStatus: value(access.PartnerProgramme, "status"),
          },
        })
      )
    );
    return scopedAssignments.map(toPartnerProgrammeResponse);
  }

  static async hasAnyAccess(userId) {
    const assignments = await PartnerProgrammeAccess.findAll({
      where: { user_id: positiveInteger(userId, "userId"), status: "active" },
      attributes: ["partner_id"],
      include: [
        {
          model: PartnerProgramme,
          required: true,
          attributes: ["partner_id"],
        },
      ],
    });
    return {
      hasAccess: assignments.some(
        (access) =>
          Number(value(access, "partner_id")) ===
          Number(value(access.PartnerProgramme, "partner_id"))
      ),
    };
  }

  static async authorize(userId, programmeId, capability, options = {}) {
    const access = await loadAccess(userId, programmeId, options);
    if (!access) {
      const programme = await PartnerProgramme.findByPk(
        positiveInteger(programmeId, "programmeId"),
        { attributes: ["id", "partner_id"] }
      );
      if (programme) {
        await recordAudit({
          partnerId: value(programme, "partner_id"),
          programmeId: value(programme, "id"),
          actorUserId: positiveInteger(userId, "userId"),
          eventType: "access_denied",
          action: capability,
          resourceType: "partner_programme",
          outcome: "denied",
          reasonCode: "assignment_missing",
        });
      }
      throw deniedError();
    }
    const decision = evaluateAccess({
      accessStatus: value(access, "status"),
      role: value(access, "access_role"),
      partnerStatus: value(access.Partner, "status"),
      programmeStatus: value(access.PartnerProgramme, "status"),
      capability,
      accessPartnerId: value(access, "partner_id"),
      programmePartnerId: value(access.PartnerProgramme, "partner_id"),
    });
    if (!decision.allowed) {
      await recordAudit({
        partnerId: value(access, "partner_id"),
        programmeId: value(access, "partner_programme_id"),
        accessId: value(access, "id"),
        actorUserId: positiveInteger(userId, "userId"),
        subjectUserId: value(access, "user_id"),
        eventType: "access_denied",
        action: capability,
        resourceType: "partner_programme",
        outcome: "denied",
        reasonCode: decision.reasonCode,
        details: {
          role: value(access, "access_role"),
          programmeStatus: value(access.PartnerProgramme, "status"),
        },
      });
      throw deniedError();
    }
    return access;
  }

  static async getProgramme(userId, programmeId) {
    const access = await this.authorize(userId, programmeId, "programme:view");
    await recordAudit({
      partnerId: value(access, "partner_id"),
      programmeId: value(access, "partner_programme_id"),
      accessId: value(access, "id"),
      actorUserId: positiveInteger(userId, "userId"),
      subjectUserId: value(access, "user_id"),
      eventType: "programme_viewed",
      action: "programme:view",
      resourceType: "partner_programme",
      outcome: "allowed",
      details: {
        role: value(access, "access_role"),
        partnerType: value(access.Partner, "partner_type"),
        programmeStatus: value(access.PartnerProgramme, "status"),
      },
    });
    return toPartnerProgrammeResponse(access);
  }

  static async getAuditEvents(userId, programmeId) {
    const access = await this.authorize(userId, programmeId, "audit:view");
    const [accessEvents, programmeEvents] = await Promise.all([
      PartnerAccessAuditEvent.findAll({
        where: { partner_programme_id: value(access, "partner_programme_id") },
        attributes: [
          "id",
          "event_type",
          "action",
          "resource_type",
          "outcome",
          "reason_code",
          "details",
          "occurred_at",
        ],
        order: [["occurred_at", "DESC"]],
        limit: 200,
      }),
      PartnerProgrammeAuditEvent.findAll({
        where: { partner_programme_id: value(access, "partner_programme_id") },
        attributes: [
          "id",
          "event_type",
          "previous_status",
          "new_status",
          "occurred_at",
        ],
        order: [["occurred_at", "DESC"]],
        limit: 200,
      }),
    ]);
    await recordAudit({
      partnerId: value(access, "partner_id"),
      programmeId: value(access, "partner_programme_id"),
      accessId: value(access, "id"),
      actorUserId: positiveInteger(userId, "userId"),
      subjectUserId: value(access, "user_id"),
      eventType: "audit_viewed",
      action: "audit:view",
      resourceType: "partner_access_audit",
      outcome: "allowed",
      details: { role: value(access, "access_role") },
    });
    const safeAccessEvents = accessEvents.map((event) => ({
      id: value(event, "id"),
      eventType: value(event, "event_type"),
      action: value(event, "action"),
      resourceType: value(event, "resource_type"),
      outcome: value(event, "outcome"),
      reasonCode: value(event, "reason_code"),
      details: safeAuditDetails(value(event, "details")),
      actorType: ["access_granted", "access_role_changed", "access_revoked"].includes(
        value(event, "event_type")
      )
        ? "hometruth_operator"
        : "partner_user",
      occurredAt: value(event, "occurred_at"),
    }));
    const safeProgrammeEvents = programmeEvents.map((event) => ({
      id: `programme-${value(event, "id")}`,
      eventType: value(event, "event_type"),
      action: `programme:${value(event, "event_type")}`,
      resourceType: "partner_programme",
      outcome: "allowed",
      reasonCode: null,
      details: safeAuditDetails({
        programmeStatus: value(event, "new_status") || value(event, "previous_status"),
      }),
      actorType: "hometruth_operator",
      occurredAt: value(event, "occurred_at"),
    }));
    return [...safeAccessEvents, ...safeProgrammeEvents]
      .sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt))
      .slice(0, 200);
  }

  static async denyIndividualResource(userId, programmeId, resourceType) {
    if (!INDIVIDUAL_RESOURCE_TYPES.has(resourceType)) throw deniedError();
    const programme = await PartnerProgramme.findByPk(
      positiveInteger(programmeId, "programmeId"),
      { attributes: ["id", "partner_id"] }
    );
    if (programme) {
      const access = await PartnerProgrammeAccess.findOne({
        where: {
          user_id: positiveInteger(userId, "userId"),
          partner_programme_id: value(programme, "id"),
        },
        attributes: ["id", "user_id", "access_role"],
      });
      await recordAudit({
        partnerId: value(programme, "partner_id"),
        programmeId: value(programme, "id"),
        accessId: value(access, "id") || null,
        actorUserId: positiveInteger(userId, "userId"),
        subjectUserId: value(access, "user_id") || null,
        eventType: "access_denied",
        action: `${resourceType}:view`,
        resourceType,
        outcome: "denied",
        reasonCode: "individual_data_prohibited",
        details: {
          role: value(access, "access_role") || "unassigned",
          resourceClass: resourceType,
        },
      });
    }
    throw deniedError();
  }
}

PartnerAccessService.Error = PartnerAccessError;
PartnerAccessService.ROLES = ROLES;
PartnerAccessService.ROLE_CAPABILITIES = ROLE_CAPABILITIES;
PartnerAccessService.evaluateAccess = evaluateAccess;
PartnerAccessService.safeAuditDetails = safeAuditDetails;
PartnerAccessService.toPartnerProgrammeResponse = toPartnerProgrammeResponse;

module.exports = PartnerAccessService;
