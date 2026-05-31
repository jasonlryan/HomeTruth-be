const { Op } = require("sequelize");
const OpenAIEmbeddingService = require("./openaiEmbeddingService");
const UserDocumentVectorService = require("./userDocumentVectorService");
const VectorStore = require("./vectorStore");
const {
  EvidenceSource,
  Property,
  PropertyAddress,
  PropertyDocument,
  PropertyFact,
  PropertyPerson,
  PropertyTask,
  UserDocument,
} = require("../models");

const DEFAULT_LIMITS = {
  userDocuments: 6,
  generalKnowledge: 6,
  propertyFacts: 12,
  propertyTasks: 8,
  excerptCharacters: 1200,
};

class UnifiedRetrievalAccessError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "UnifiedRetrievalAccessError";
    this.statusCode = statusCode;
  }
}

const toPositiveInteger = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new UnifiedRetrievalAccessError(`${fieldName} must be a positive integer`);
  }
  return parsed;
};

const normalizeOptionalPositiveInteger = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return null;
  return toPositiveInteger(value, fieldName);
};

const formatDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
};

const compact = (values) => values.filter(Boolean);

const truncate = (text, maxLength = DEFAULT_LIMITS.excerptCharacters) => {
  if (!text) return "";
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
};

const formatJsonValue = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
};

const addressLine = (address) => {
  if (!address) return null;
  return compact([
    address.address_line_1,
    address.address_line_2,
    address.town_city,
    address.county,
    address.postcode,
    address.country,
  ]).join(", ");
};

class UnifiedRetrievalService {
  static emptyContext(query = "", scope = {}, errors = []) {
    return {
      query,
      contextText: "",
      sourceSummary: {
        hasContext: false,
        sourceClasses: [],
        uploadedUserDocuments: 0,
        propertyRecords: 0,
        homeTruthGuidance: 0,
        errors,
      },
      scope,
      sections: {
        uploadedUserDocuments: [],
        propertyRecord: null,
        homeTruthGuidance: [],
      },
    };
  }

  static async assembleAssistantContext({
    query,
    userId,
    propertyId = null,
    includeUserDocuments = true,
    includePropertyRecord = true,
    includeGeneralKnowledge = true,
    limits = {},
  }) {
    const normalizedUserId = toPositiveInteger(userId, "userId");
    const normalizedPropertyId = normalizeOptionalPositiveInteger(
      propertyId,
      "propertyId"
    );
    const mergedLimits = { ...DEFAULT_LIMITS, ...limits };

    const propertyContext =
      includePropertyRecord && normalizedPropertyId
        ? await this.buildPropertyContext(normalizedUserId, normalizedPropertyId, mergedLimits)
        : null;

    const queryEmbedding = await OpenAIEmbeddingService.generateEmbedding(query);
    const errors = [];

    const userDocumentFilters = normalizedPropertyId
      ? { documentIds: propertyContext.linkedUserDocumentIds }
      : {};

    const [uploadedUserDocuments, homeTruthGuidance] = await Promise.all([
      includeUserDocuments
        ? UserDocumentVectorService.searchUserDocumentsByEmbedding(
            queryEmbedding,
            normalizedUserId,
            userDocumentFilters,
            mergedLimits.userDocuments
          ).catch((error) => {
            errors.push(`user_documents: ${error.message}`);
            return [];
          })
        : Promise.resolve([]),
      includeGeneralKnowledge
        ? VectorStore.searchSimilarChunksByEmbedding(
            queryEmbedding,
            mergedLimits.generalKnowledge,
            0.5
          ).catch((error) => {
            errors.push(`home_truth_documents: ${error.message}`);
            return [];
          })
        : Promise.resolve([]),
    ]);

    const contextText = this.formatAssistantContext({
      uploadedUserDocuments,
      propertyContext,
      homeTruthGuidance,
      limits: mergedLimits,
    });

    const sourceClasses = [];
    if (uploadedUserDocuments.length) sourceClasses.push("uploaded_user_document");
    if (propertyContext?.hasContext) sourceClasses.push("property_record");
    if (homeTruthGuidance.length) sourceClasses.push("home_truth_guidance");

    return {
      query,
      contextText,
      sourceSummary: {
        hasContext: contextText.length > 0,
        sourceClasses,
        uploadedUserDocuments: uploadedUserDocuments.length,
        propertyRecords: propertyContext?.hasContext ? 1 : 0,
        homeTruthGuidance: homeTruthGuidance.length,
        errors,
      },
      scope: {
        userId: normalizedUserId,
        propertyId: normalizedPropertyId,
        userDocumentScope: normalizedPropertyId
          ? "selected_property_documents"
          : "all_current_user_documents",
        propertyLinkedUserDocumentIds: propertyContext?.linkedUserDocumentIds || null,
      },
      sections: {
        uploadedUserDocuments,
        propertyRecord: propertyContext,
        homeTruthGuidance,
      },
    };
  }

  static async buildPropertyContext(userId, propertyId, limits = DEFAULT_LIMITS) {
    const relationship = await PropertyPerson.findOne({
      where: {
        user_id: userId,
        property_id: propertyId,
        relationship_status: "active",
      },
    });

    if (!relationship) {
      throw new UnifiedRetrievalAccessError("Property record not found", 404);
    }

    const [property, currentAddress, linkedDocuments, facts, tasks] =
      await Promise.all([
        Property.findByPk(propertyId),
        PropertyAddress.findOne({
          where: { property_id: propertyId, is_current: true },
          order: [["updatedAt", "DESC"]],
        }),
        this.findLinkedUserDocuments(userId, propertyId),
        PropertyFact.findAll({
          where: { property_id: propertyId, is_current: true },
          order: [
            ["fact_namespace", "ASC"],
            ["fact_type", "ASC"],
            ["updatedAt", "DESC"],
          ],
          limit: limits.propertyFacts,
        }),
        PropertyTask.findAll({
          where: { property_id: propertyId, status: "open" },
          order: [
            ["priority", "DESC"],
            ["due_date", "ASC"],
            ["updatedAt", "DESC"],
          ],
          limit: limits.propertyTasks,
        }),
      ]);

    if (!property) {
      throw new UnifiedRetrievalAccessError("Property record not found", 404);
    }

    const evidenceById = await this.findEvidenceSourcesForFacts(facts);
    const lines = [];
    lines.push(
      `Property: ${property.property_type || "unknown"}; tenure: ${
        property.tenure || "unknown"
      }; status: ${property.lifecycle_status || "unknown"}.`
    );

    const formattedAddress = addressLine(currentAddress);
    if (formattedAddress) lines.push(`Current address: ${formattedAddress}.`);

    lines.push(
      `User relationship: ${relationship.relationship_type}; permission: ${relationship.permission_level}.`
    );

    if (linkedDocuments.length) {
      lines.push("Linked uploaded documents visible to this user:");
      linkedDocuments.forEach((document) => {
        lines.push(
          `- ${document.name}${document.doc_type ? ` (${document.doc_type})` : ""}${
            document.category ? `; category: ${document.category}` : ""
          }`
        );
      });
    }

    if (facts.length) {
      lines.push("Current property facts:");
      facts.forEach((fact) => {
        const evidence = evidenceById.get(fact.evidence_source_id);
        const value = fact.display_value || formatJsonValue(fact.value_json);
        lines.push(
          `- ${fact.fact_namespace}.${fact.fact_type}: ${value || "recorded"}${
            fact.unit ? ` ${fact.unit}` : ""
          }; verification: ${fact.verification_status}${
            evidence?.source_name ? `; evidence: ${evidence.source_name}` : ""
          }.`
        );
      });
    }

    if (tasks.length) {
      lines.push("Open property actions:");
      tasks.forEach((task) => {
        lines.push(
          `- ${task.title}; priority: ${task.priority}${
            task.due_date ? `; due: ${formatDateOnly(task.due_date)}` : ""
          }${task.recommended_action ? `; action: ${truncate(task.recommended_action, 240)}` : ""}.`
        );
      });
    }

    return {
      hasContext: lines.length > 0,
      propertyId,
      relationshipType: relationship.relationship_type,
      permissionLevel: relationship.permission_level,
      linkedUserDocumentIds: linkedDocuments.map((document) => document.id),
      text: lines.join("\n"),
    };
  }

  static async findLinkedUserDocuments(userId, propertyId) {
    const links = await PropertyDocument.findAll({
      where: {
        property_id: propertyId,
        is_active: true,
      },
      attributes: ["user_document_id"],
    });

    const documentIds = [...new Set(links.map((link) => link.user_document_id))];
    if (!documentIds.length) return [];

    return UserDocument.findAll({
      where: {
        id: { [Op.in]: documentIds },
        user_id: userId,
        is_active: true,
      },
      order: [["updated_at", "DESC"]],
    });
  }

  static async findEvidenceSourcesForFacts(facts) {
    const evidenceIds = [
      ...new Set(facts.map((fact) => fact.evidence_source_id).filter(Boolean)),
    ];
    if (!evidenceIds.length) return new Map();

    const sources = await EvidenceSource.findAll({
      where: { id: { [Op.in]: evidenceIds } },
    });
    return new Map(sources.map((source) => [source.id, source]));
  }

  static formatAssistantContext({
    uploadedUserDocuments = [],
    propertyContext = null,
    homeTruthGuidance = [],
    limits = DEFAULT_LIMITS,
  }) {
    const sections = [];

    if (uploadedUserDocuments.length) {
      const chunks = uploadedUserDocuments.map((chunk, index) => {
        const metadata = chunk.metadata || {};
        return compact([
          `Uploaded user document ${index + 1}`,
          `Source class: uploaded user document`,
          `File: ${metadata.filename || "Uploaded document"}`,
          metadata.doc_type ? `Document type: ${metadata.doc_type}` : null,
          metadata.category ? `Category: ${metadata.category}` : null,
          `Excerpt: ${truncate(chunk.text, limits.excerptCharacters)}`,
        ]).join("\n");
      });

      sections.push(`**Uploaded user document context:**\n${chunks.join("\n\n")}`);
    }

    if (propertyContext?.hasContext) {
      sections.push(`**Property record context:**\n${propertyContext.text}`);
    }

    if (homeTruthGuidance.length) {
      const chunks = homeTruthGuidance.map((chunk, index) => {
        const metadata = chunk.metadata || {};
        return compact([
          `HomeTruth guidance ${index + 1}`,
          `Source class: HomeTruth guidance`,
          `Title: ${metadata.title || metadata.filename || "HomeTruth knowledge base"}`,
          metadata.category ? `Category: ${metadata.category}` : null,
          metadata.source ? `Source: ${metadata.source}` : null,
          `Excerpt: ${truncate(chunk.text, limits.excerptCharacters)}`,
        ]).join("\n");
      });

      sections.push(`**HomeTruth guidance context:**\n${chunks.join("\n\n")}`);
    }

    if (!sections.length) return "";

    return [
      "**Sources section:**",
      "Use these labelled source classes as the evidence base. Do not expose raw retrieval scores or internal metadata.",
      sections.join("\n\n"),
    ].join("\n\n");
  }
}

UnifiedRetrievalService.UnifiedRetrievalAccessError = UnifiedRetrievalAccessError;
UnifiedRetrievalService.DEFAULT_LIMITS = DEFAULT_LIMITS;

module.exports = UnifiedRetrievalService;
