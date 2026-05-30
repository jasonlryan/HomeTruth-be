const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  EvidenceSource,
  Property,
  PropertyAddress,
  PropertyDocument,
  PropertyFact,
  PropertyPerson,
  PropertyTask,
  PropertyTaskStatusEvent,
  UserDocument,
} = require("../models");
const PilotAnalyticsService = require("./pilotAnalyticsService");

const READ_PERMISSION_LEVELS = new Set(["read", "contribute", "manage", "admin"]);
const CONTRIBUTOR_PERMISSION_LEVELS = new Set(["contribute", "manage", "admin"]);

const TASK_STATUSES = new Set(["open", "completed", "dismissed", "not_relevant"]);
const TASK_TYPES = new Set([
  "service_due",
  "seasonal_check",
  "document_expiry",
  "missing_baseline",
  "known_issue_follow_up",
  "evidence_improvement",
]);
const PRIORITIES = new Set(["low", "medium", "high"]);

class PropertyTaskError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "PropertyTaskError";
    this.statusCode = statusCode;
  }
}

const toIntegerId = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PropertyTaskError(`${fieldName} must be a positive integer`);
  }
  return parsed;
};

const toDateOnly = (date) => {
  if (!date) return null;
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const extractDateValue = (value) => {
  if (!value) return null;
  if (typeof value === "string" || value instanceof Date) return toDateOnly(value);
  if (typeof value !== "object") return null;

  return (
    toDateOnly(value.date) ||
    toDateOnly(value.dueDate) ||
    toDateOnly(value.due_date) ||
    toDateOnly(value.expiryDate) ||
    toDateOnly(value.expiry_date) ||
    toDateOnly(value.nextServiceDue) ||
    toDateOnly(value.next_service_due) ||
    toDateOnly(value.value)
  );
};

const getActiveRelationship = async (userId, propertyId, options = {}) =>
  PropertyPerson.findOne({
    where: {
      property_id: propertyId,
      user_id: userId,
      relationship_status: "active",
    },
    transaction: options.transaction,
  });

const requirePropertyPermission = async (
  userId,
  propertyId,
  allowedPermissionLevels,
  options = {}
) => {
  const relationship = await getActiveRelationship(userId, propertyId, options);
  if (!relationship) {
    throw new PropertyTaskError("Property record not found", 404);
  }

  if (!allowedPermissionLevels.has(relationship.permission_level)) {
    throw new PropertyTaskError(
      "You do not have permission to manage tasks for this property",
      403
    );
  }

  return relationship;
};

const normalizeStatus = (value) => {
  const status = value || "open";
  if (!TASK_STATUSES.has(status)) {
    throw new PropertyTaskError(`Unsupported task status: ${status}`);
  }
  return status;
};

const normalizeTaskProposal = (proposal) => {
  if (!TASK_TYPES.has(proposal.taskType)) {
    throw new PropertyTaskError(`Unsupported task type: ${proposal.taskType}`);
  }
  if (!PRIORITIES.has(proposal.priority || "medium")) {
    throw new PropertyTaskError(`Unsupported task priority: ${proposal.priority}`);
  }

  return {
    task_type: proposal.taskType,
    title: proposal.title,
    description: proposal.description || null,
    recommended_action: proposal.recommendedAction || null,
    priority: proposal.priority || "medium",
    source_type: proposal.sourceType || "rule",
    source_model: proposal.sourceModel || null,
    source_id: proposal.sourceId || null,
    generation_key: proposal.generationKey,
    due_date: proposal.dueDate || null,
    metadata: proposal.metadata || null,
  };
};

const toTaskResponse = (task) => ({
  id: task.id,
  propertyId: task.property_id,
  assignedUserId: task.assigned_user_id,
  taskType: task.task_type,
  title: task.title,
  description: task.description,
  recommendedAction: task.recommended_action,
  priority: task.priority,
  status: task.status,
  sourceType: task.source_type,
  sourceModel: task.source_model,
  sourceId: task.source_id,
  generationKey: task.generation_key,
  dueDate: task.due_date,
  generatedAt: task.generated_at,
  completedAt: task.completed_at,
  dismissedAt: task.dismissed_at,
  notRelevantAt: task.not_relevant_at,
  statusUpdatedAt: task.status_updated_at,
  statusUpdatedByUserId: task.status_updated_by_user_id,
  metadata: task.metadata,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});

const recordPilotEventSilently = async (payload, options = {}) => {
  try {
    return await PilotAnalyticsService.recordEvent(payload, options);
  } catch (error) {
    console.error("Pilot event capture failed:", error.message);
    return null;
  }
};

const makeTask = (propertyId, keySuffix, proposal) => ({
  ...proposal,
  generationKey: `property:${propertyId}:${keySuffix}`,
});

const duePriority = (dueDate) => {
  if (!dueDate) return "medium";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return "high";
  if (daysUntilDue <= 30) return "high";
  return "medium";
};

const buildMissingBaselineTasks = (property, currentAddress) => {
  const tasks = [];

  if (property.property_type === "unknown") {
    tasks.push(
      makeTask(property.id, "missing:property_type", {
        taskType: "missing_baseline",
        title: "Add your property type",
        description: "Property type helps HomeTruth make actions more relevant.",
        recommendedAction: "Confirm whether this home is a house, flat or another property type.",
        priority: "medium",
        sourceType: "property",
        sourceModel: "Property",
        sourceId: property.id,
        metadata: { missingField: "propertyType" },
      })
    );
  }

  if (property.tenure === "unknown") {
    tasks.push(
      makeTask(property.id, "missing:tenure", {
        taskType: "missing_baseline",
        title: "Confirm the tenure",
        description: "Tenure affects the documents and responsibilities HomeTruth should track.",
        recommendedAction: "Add whether the property is freehold, leasehold or another tenure.",
        priority: "medium",
        sourceType: "property",
        sourceModel: "Property",
        sourceId: property.id,
        metadata: { missingField: "tenure" },
      })
    );
  }

  if (!currentAddress?.postcode) {
    tasks.push(
      makeTask(property.id, "missing:postcode", {
        taskType: "missing_baseline",
        title: "Add the postcode",
        description: "Postcode helps connect the property record to external address, risk and service data.",
        recommendedAction: "Add the postcode to complete the core address.",
        priority: "medium",
        sourceType: "property",
        sourceModel: "PropertyAddress",
        sourceId: currentAddress?.id || null,
        metadata: { missingField: "postcode" },
      })
    );
  }

  return tasks;
};

const buildDocumentTasks = (propertyId, linkedDocuments) => {
  const tasks = [];
  const today = new Date();
  const reviewWindowEnd = addDays(today, 90);

  if (!linkedDocuments.length) {
    tasks.push(
      makeTask(propertyId, "missing:documents", {
        taskType: "missing_baseline",
        title: "Add key property documents",
        description: "Documents make the home record more useful and give evidence for future actions.",
        recommendedAction: "Upload or link a policy, certificate, survey, warranty or service document.",
        priority: "medium",
        sourceType: "rule",
        metadata: { missingField: "documents" },
      })
    );
  }

  linkedDocuments.forEach(({ link, document }) => {
    const dueDate = toDateOnly(link.expiry_date || document?.expiry_date);
    if (!dueDate) return;

    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime()) || due > reviewWindowEnd) return;

    const documentName = document?.name || "property document";
    tasks.push(
      makeTask(propertyId, `document:${link.id}:expiry`, {
        taskType: "document_expiry",
        title: "Review expiring document",
        description: `${documentName} has an expiry or review date that should be checked.`,
        recommendedAction: "Review the document and add updated evidence if you have it.",
        priority: duePriority(dueDate),
        sourceType: "property_document",
        sourceModel: "PropertyDocument",
        sourceId: link.id,
        dueDate,
        metadata: {
          documentId: document?.id || null,
          documentName,
          documentType: document?.doc_type || null,
        },
      })
    );
  });

  return tasks;
};

const buildFactTasks = (propertyId, facts) => {
  const tasks = [];

  if (!facts.length) {
    tasks.push(
      makeTask(propertyId, "missing:facts", {
        taskType: "missing_baseline",
        title: "Add your first property fact",
        description: "Facts turn the property profile into a usable home record.",
        recommendedAction: "Add a useful fact such as boiler age, EPC rating, roof age or a known issue.",
        priority: "low",
        sourceType: "rule",
        metadata: { missingField: "propertyFacts" },
      })
    );
  }

  facts.forEach((fact) => {
    const factLabel = fact.display_value || `${fact.fact_namespace}.${fact.fact_type}`;

    if (fact.verification_status === "suggested") {
      tasks.push(
        makeTask(propertyId, `fact:${fact.id}:confirm`, {
          taskType: "evidence_improvement",
          title: "Confirm a suggested property fact",
          description: `${factLabel} is recorded as a suggested fact.`,
          recommendedAction: "Confirm it, dispute it or add evidence so the property record is clearer.",
          priority: "medium",
          sourceType: "property_fact",
          sourceModel: "PropertyFact",
          sourceId: fact.id,
          metadata: {
            factKey: `${fact.fact_namespace}.${fact.fact_type}`,
            verificationStatus: fact.verification_status,
          },
        })
      );
    }

    if (fact.fact_namespace === "maintenance" && fact.fact_type === "next_service_due") {
      const dueDate =
        extractDateValue(fact.value_json) ||
        toDateOnly(fact.valid_to) ||
        toDateOnly(fact.valid_from);

      tasks.push(
        makeTask(propertyId, `fact:${fact.id}:service_due`, {
          taskType: "service_due",
          title: "Review upcoming service",
          description: `${factLabel} indicates a service date to review.`,
          recommendedAction: "Check whether the service is booked, complete or no longer relevant.",
          priority: duePriority(dueDate),
          sourceType: "property_fact",
          sourceModel: "PropertyFact",
          sourceId: fact.id,
          dueDate,
          metadata: { factKey: "maintenance.next_service_due" },
        })
      );
    }

    if (
      fact.fact_namespace === "compliance" &&
      fact.fact_type === "certificate_expiry"
    ) {
      const dueDate =
        extractDateValue(fact.value_json) ||
        toDateOnly(fact.valid_to) ||
        toDateOnly(fact.valid_from);

      tasks.push(
        makeTask(propertyId, `fact:${fact.id}:certificate_expiry`, {
          taskType: "document_expiry",
          title: "Review certificate expiry",
          description: `${factLabel} may need checking before it expires.`,
          recommendedAction: "Review the certificate and add updated evidence if available.",
          priority: duePriority(dueDate),
          sourceType: "property_fact",
          sourceModel: "PropertyFact",
          sourceId: fact.id,
          dueDate,
          metadata: { factKey: "compliance.certificate_expiry" },
        })
      );
    }

    if (fact.fact_namespace === "insurance" && fact.fact_type === "policy_expiry") {
      const dueDate =
        extractDateValue(fact.value_json) ||
        toDateOnly(fact.valid_to) ||
        toDateOnly(fact.valid_from);

      tasks.push(
        makeTask(propertyId, `fact:${fact.id}:policy_expiry`, {
          taskType: "document_expiry",
          title: "Review policy document",
          description: `${factLabel} has a policy date to review.`,
          recommendedAction: "Check the policy document and update the record if anything has changed.",
          priority: duePriority(dueDate),
          sourceType: "property_fact",
          sourceModel: "PropertyFact",
          sourceId: fact.id,
          dueDate,
          metadata: { factKey: "insurance.policy_expiry" },
        })
      );
    }

    if (fact.fact_namespace === "risk" && fact.fact_type === "known_issue") {
      tasks.push(
        makeTask(propertyId, `fact:${fact.id}:known_issue_follow_up`, {
          taskType: "known_issue_follow_up",
          title: "Follow up a known issue",
          description: `${factLabel} is recorded as a known issue for this home.`,
          recommendedAction: "Review the issue and add an update, repair evidence or mark it no longer relevant.",
          priority: "high",
          sourceType: "property_fact",
          sourceModel: "PropertyFact",
          sourceId: fact.id,
          metadata: { factKey: "risk.known_issue" },
        })
      );
    }
  });

  return tasks;
};

const loadTaskInputs = async (propertyId, options = {}) => {
  const [property, currentAddress, links, facts] = await Promise.all([
    Property.findByPk(propertyId, { transaction: options.transaction }),
    PropertyAddress.findOne({
      where: { property_id: propertyId, is_current: true },
      order: [["updatedAt", "DESC"]],
      transaction: options.transaction,
    }),
    PropertyDocument.findAll({
      where: { property_id: propertyId, is_active: true },
      order: [["updatedAt", "DESC"]],
      transaction: options.transaction,
    }),
    PropertyFact.findAll({
      where: { property_id: propertyId, is_current: true },
      order: [["updatedAt", "DESC"]],
      transaction: options.transaction,
    }),
  ]);

  if (!property) {
    throw new PropertyTaskError("Property record not found", 404);
  }

  const documents = links.length
    ? await UserDocument.findAll({
        where: {
          id: links.map((link) => link.user_document_id),
          is_active: true,
        },
        transaction: options.transaction,
      })
    : [];
  const documentsById = new Map(
    documents.map((document) => [document.id, document])
  );

  const linkedDocuments = links.map((link) => ({
    link,
    document: documentsById.get(link.user_document_id),
  }));

  return {
    property,
    currentAddress,
    linkedDocuments,
    facts,
  };
};

class PropertyTaskService {
  static async listPropertyTasks(userId, propertyId, filters = {}, options = {}) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");
    await requirePropertyPermission(
      userId,
      normalizedPropertyId,
      READ_PERMISSION_LEVELS,
      options
    );

    const where = { property_id: normalizedPropertyId };
    if (filters.status && filters.status !== "all") {
      where.status = normalizeStatus(filters.status);
    }

    if (filters.statuses && Array.isArray(filters.statuses)) {
      const statuses = filters.statuses.map((status) => normalizeStatus(status));
      where.status = { [Op.in]: statuses };
    }

    const tasks = await PropertyTask.findAll({
      where,
      order: [
        ["due_date", "ASC"],
        ["priority", "DESC"],
        ["updatedAt", "DESC"],
      ],
      transaction: options.transaction,
    });

    return tasks.map(toTaskResponse);
  }

  static async generateTasksForProperty(userId, propertyId) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");

    return sequelize.transaction(async (transaction) => {
      await requirePropertyPermission(
        userId,
        normalizedPropertyId,
        CONTRIBUTOR_PERMISSION_LEVELS,
        { transaction }
      );

      const { property, currentAddress, linkedDocuments, facts } =
        await loadTaskInputs(normalizedPropertyId, { transaction });

      const proposals = [
        ...buildMissingBaselineTasks(property, currentAddress),
        ...buildDocumentTasks(normalizedPropertyId, linkedDocuments),
        ...buildFactTasks(normalizedPropertyId, facts),
      ];

      const generated = [];
      let createdCount = 0;
      let updatedCount = 0;

      for (const proposal of proposals) {
        const payload = normalizeTaskProposal(proposal);
        const existing = await PropertyTask.findOne({
          where: { generation_key: payload.generation_key },
          transaction,
        });

        if (existing) {
          if (existing.status === "open") {
            await existing.update(
              {
                ...payload,
                assigned_user_id: existing.assigned_user_id || userId,
              },
              { transaction }
            );
            updatedCount += 1;
          }
          generated.push(existing);
          continue;
        }

        const task = await PropertyTask.create(
          {
            ...payload,
            property_id: normalizedPropertyId,
            assigned_user_id: userId,
            status: "open",
            generated_at: new Date(),
          },
          { transaction }
        );

        await PropertyTaskStatusEvent.create(
          {
            property_task_id: task.id,
            property_id: normalizedPropertyId,
            user_id: userId,
            from_status: null,
            to_status: "open",
            reason: "generated",
            metadata: { generationKey: payload.generation_key },
          },
          { transaction }
        );

        createdCount += 1;
        generated.push(task);
      }

      const openTasks = await this.listPropertyTasks(
        userId,
        normalizedPropertyId,
        { status: "open" },
        { transaction }
      );

      await recordPilotEventSilently(
        {
          eventName: "tasks_generated",
          userId,
          propertyId: normalizedPropertyId,
          sourceType: "property_task",
          sourceModel: "PropertyTask",
          metadata: {
            createdCount,
            updatedCount,
            proposalCount: proposals.length,
            openTaskCount: openTasks.length,
          },
        },
        { transaction }
      );

      return {
        createdCount,
        updatedCount,
        proposalCount: proposals.length,
        tasks: openTasks,
      };
    });
  }

  static async updateTaskStatus(userId, propertyId, taskId, payload = {}) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");
    const normalizedTaskId = toIntegerId(taskId, "taskId");
    const nextStatus = normalizeStatus(payload.status);

    return sequelize.transaction(async (transaction) => {
      const relationship = await requirePropertyPermission(
        userId,
        normalizedPropertyId,
        READ_PERMISSION_LEVELS,
        { transaction }
      );

      const task = await PropertyTask.findOne({
        where: {
          id: normalizedTaskId,
          property_id: normalizedPropertyId,
        },
        transaction,
      });

      if (!task) {
        throw new PropertyTaskError("Property task not found", 404);
      }

      const canUpdate =
        task.assigned_user_id === userId ||
        CONTRIBUTOR_PERMISSION_LEVELS.has(relationship.permission_level);

      if (!canUpdate) {
        throw new PropertyTaskError(
          "You do not have permission to update this task",
          403
        );
      }

      const previousStatus = task.status;
      if (previousStatus === nextStatus) {
        return toTaskResponse(task);
      }

      const timestamp = new Date();
      await task.update(
        {
          status: nextStatus,
          completed_at: nextStatus === "completed" ? timestamp : null,
          dismissed_at: nextStatus === "dismissed" ? timestamp : null,
          not_relevant_at: nextStatus === "not_relevant" ? timestamp : null,
          status_updated_at: timestamp,
          status_updated_by_user_id: userId,
        },
        { transaction }
      );

      await PropertyTaskStatusEvent.create(
        {
          property_task_id: task.id,
          property_id: normalizedPropertyId,
          user_id: userId,
          from_status: previousStatus,
          to_status: nextStatus,
          reason: payload.reason || null,
          metadata: payload.metadata || null,
        },
        { transaction }
      );

      const eventNameByStatus = {
        completed: "task_completed",
        dismissed: "task_dismissed",
        not_relevant: "task_not_relevant",
      };

      if (eventNameByStatus[nextStatus]) {
        await recordPilotEventSilently(
          {
            eventName: eventNameByStatus[nextStatus],
            userId,
            propertyId: normalizedPropertyId,
            sourceType: "property_task",
            sourceModel: "PropertyTask",
            sourceId: task.id,
            metadata: {
              taskType: task.task_type,
              priority: task.priority,
              fromStatus: previousStatus,
              toStatus: nextStatus,
              hasDueDate: Boolean(task.due_date),
            },
          },
          { transaction }
        );
      }

      return toTaskResponse(task);
    });
  }

  static async listTaskStatusEvents(userId, propertyId, taskId, options = {}) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");
    const normalizedTaskId = toIntegerId(taskId, "taskId");
    await requirePropertyPermission(
      userId,
      normalizedPropertyId,
      READ_PERMISSION_LEVELS,
      options
    );

    const events = await PropertyTaskStatusEvent.findAll({
      where: {
        property_id: normalizedPropertyId,
        property_task_id: normalizedTaskId,
      },
      order: [["createdAt", "DESC"]],
      transaction: options.transaction,
    });

    return events.map((event) => ({
      id: event.id,
      propertyTaskId: event.property_task_id,
      propertyId: event.property_id,
      userId: event.user_id,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      reason: event.reason,
      metadata: event.metadata,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    }));
  }
}

PropertyTaskService.PropertyTaskError = PropertyTaskError;

module.exports = PropertyTaskService;
