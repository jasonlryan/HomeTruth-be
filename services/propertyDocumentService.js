const {
  PropertyDocument,
  PropertyPerson,
  UserDocument,
} = require("../models");
const PilotAnalyticsService = require("./pilotAnalyticsService");

const CONTRIBUTOR_PERMISSION_LEVELS = new Set(["contribute", "manage", "admin"]);
const READ_PERMISSION_LEVELS = new Set(["read", "contribute", "manage", "admin"]);
const RELEVANCE_VALUES = new Set([
  "primary",
  "evidence",
  "supporting",
  "reference",
  "other",
]);

class PropertyDocumentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "PropertyDocumentError";
    this.statusCode = statusCode;
  }
}

const toIntegerId = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PropertyDocumentError(`${fieldName} must be a positive integer`);
  }
  return parsed;
};

const normalizeOptionalDate = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return null;
  if (Number.isNaN(Date.parse(value))) {
    throw new PropertyDocumentError(`${fieldName} must be a valid date`);
  }
  return value;
};

const normalizeLinkPayload = (payload = {}) => {
  const relevance = payload.relevance || "supporting";
  if (!RELEVANCE_VALUES.has(relevance)) {
    throw new PropertyDocumentError(`Unsupported relevance: ${relevance}`);
  }

  return {
    document_role: payload.documentRole || payload.document_role || null,
    relevance,
    effective_date: normalizeOptionalDate(
      payload.effectiveDate || payload.effective_date,
      "effectiveDate"
    ),
    expiry_date: normalizeOptionalDate(
      payload.expiryDate || payload.expiry_date,
      "expiryDate"
    ),
  };
};

const toUserDocumentResponse = (document) => ({
  id: document.id,
  name: document.name,
  docType: document.doc_type,
  status: document.status,
  category: document.category,
  tags: document.tags,
  date: document.date,
  expiryDate: document.expiry_date,
  fileType: document.file_type,
  fileSize: document.file_size,
  chunksCount: document.chunks_count,
  processedAt: document.processed_at,
  createdAt: document.created_at,
  updatedAt: document.updated_at,
});

const toPropertyDocumentResponse = (link, document) => ({
  id: link.id,
  propertyId: link.property_id,
  userDocumentId: link.user_document_id,
  linkedByUserId: link.linked_by_user_id,
  documentRole: link.document_role,
  relevance: link.relevance,
  effectiveDate: link.effective_date,
  expiryDate: link.expiry_date,
  isActive: link.is_active,
  createdAt: link.createdAt,
  updatedAt: link.updatedAt,
  document: document ? toUserDocumentResponse(document) : null,
});

const recordPilotEventSilently = async (payload, options = {}) => {
  try {
    return await PilotAnalyticsService.recordEvent(payload, options);
  } catch (error) {
    console.error("Pilot event capture failed:", error.message);
    return null;
  }
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
    throw new PropertyDocumentError("Property record not found", 404);
  }

  if (!allowedPermissionLevels.has(relationship.permission_level)) {
    throw new PropertyDocumentError(
      "You do not have permission to link documents to this property",
      403
    );
  }

  return relationship;
};

class PropertyDocumentService {
  static async assertCanLinkToProperty(userId, propertyId, payload = {}, options = {}) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");
    normalizeLinkPayload(payload);
    await requirePropertyPermission(
      userId,
      normalizedPropertyId,
      CONTRIBUTOR_PERMISSION_LEVELS,
      options
    );
    return normalizedPropertyId;
  }

  static async listLinkedDocumentsForProperty(propertyId, options = {}) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");
    const links = await PropertyDocument.findAll({
      where: {
        property_id: normalizedPropertyId,
        is_active: true,
      },
      order: [["updatedAt", "DESC"]],
      transaction: options.transaction,
    });

    if (!links.length) return [];

    const documents = await UserDocument.findAll({
      where: {
        id: links.map((link) => link.user_document_id),
        is_active: true,
      },
      transaction: options.transaction,
    });
    const documentsById = new Map(
      documents.map((document) => [document.id, document])
    );

    return links
      .map((link) =>
        toPropertyDocumentResponse(link, documentsById.get(link.user_document_id))
      )
      .filter((link) => link.document);
  }

  static async listPropertyDocuments(userId, propertyId, options = {}) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");
    await requirePropertyPermission(
      userId,
      normalizedPropertyId,
      READ_PERMISSION_LEVELS,
      options
    );
    return this.listLinkedDocumentsForProperty(normalizedPropertyId, options);
  }

  static async linkUserDocumentToProperty(
    userId,
    propertyId,
    userDocumentId,
    payload = {},
    options = {}
  ) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");
    const normalizedDocumentId = toIntegerId(userDocumentId, "documentId");
    const linkPayload = normalizeLinkPayload(payload);

    await requirePropertyPermission(
      userId,
      normalizedPropertyId,
      CONTRIBUTOR_PERMISSION_LEVELS,
      options
    );

    const document = await UserDocument.findOne({
      where: {
        id: normalizedDocumentId,
        user_id: userId,
        is_active: true,
      },
      transaction: options.transaction,
    });

    if (!document) {
      throw new PropertyDocumentError("Document not found", 404);
    }

    const existing = await PropertyDocument.findOne({
      where: {
        property_id: normalizedPropertyId,
        user_document_id: normalizedDocumentId,
      },
      transaction: options.transaction,
    });

    if (existing) {
      throw new PropertyDocumentError(
        "Document is already linked to this property",
        409
      );
    }

    const link = await PropertyDocument.create(
      {
        property_id: normalizedPropertyId,
        user_document_id: normalizedDocumentId,
        linked_by_user_id: userId,
        ...linkPayload,
        is_active: true,
      },
      { transaction: options.transaction }
    );

    await recordPilotEventSilently(
      {
        eventName: "document_linked",
        userId,
        propertyId: normalizedPropertyId,
        sourceType: "property_document",
        sourceModel: "PropertyDocument",
        sourceId: link.id,
        metadata: {
          relevance: link.relevance,
          documentRole: link.document_role,
          documentType: document.doc_type,
          documentCategory: document.category,
          hasExpiryDate: Boolean(link.expiry_date || document.expiry_date),
        },
      },
      options
    );

    return toPropertyDocumentResponse(link, document);
  }
}

PropertyDocumentService.PropertyDocumentError = PropertyDocumentError;

module.exports = PropertyDocumentService;
