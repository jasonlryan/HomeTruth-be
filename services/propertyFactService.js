const sequelize = require("../config/database");
const {
  EvidenceSource,
  PropertyDocument,
  PropertyFact,
  PropertyPerson,
  UserDocument,
} = require("../models");

const READ_PERMISSION_LEVELS = new Set(["read", "contribute", "manage", "admin"]);
const CONTRIBUTOR_PERMISSION_LEVELS = new Set(["contribute", "manage", "admin"]);

const FACT_TAXONOMY = {
  maintenance: new Set(["last_service_date", "next_service_due"]),
  compliance: new Set(["certificate_expiry"]),
  insurance: new Set(["policy_expiry"]),
  risk: new Set(["known_issue"]),
  repair: new Set(["repair_event"]),
};

const CREATED_FROM_VALUES = new Set(["manual", "ocr", "ai", "partner_api", "system"]);
const DOCUMENT_DERIVED_CREATED_FROM = new Set(["ocr", "ai"]);
const EVIDENCE_SOURCE_TYPES = new Set([
  "user_document",
  "system_document",
  "url",
  "manual",
  "partner_api",
  "listing",
  "ai_extraction",
]);
const EXTRACTION_METHODS = new Set(["manual", "ocr", "ai", "partner_api", "system"]);
const VERIFICATION_STATUSES = new Set([
  "suggested",
  "user_confirmed",
  "evidence_verified",
  "partner_verified",
  "disputed",
  "expired",
]);

class PropertyFactError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "PropertyFactError";
    this.statusCode = statusCode;
  }
}

const toIntegerId = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PropertyFactError(`${fieldName} must be a positive integer`);
  }
  return parsed;
};

const requireValue = (value, message) => {
  if (value === undefined || value === null || value === "") {
    throw new PropertyFactError(message, 400);
  }
};

const normalizeOptionalDate = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return null;
  if (Number.isNaN(Date.parse(value))) {
    throw new PropertyFactError(`${fieldName} must be a valid date`);
  }
  return value;
};

const normalizeConfidence = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const confidence = Number(value);
  if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new PropertyFactError("confidence must be between 0 and 1");
  }
  return confidence;
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
    throw new PropertyFactError("Property record not found", 404);
  }

  if (!allowedPermissionLevels.has(relationship.permission_level)) {
    throw new PropertyFactError(
      "You do not have permission to manage facts for this property",
      403
    );
  }

  return relationship;
};

const normalizeFactKey = (payload = {}) => {
  const factNamespace = payload.factNamespace || payload.fact_namespace;
  const factType = payload.factType || payload.fact_type;
  requireValue(factNamespace, "factNamespace is required");
  requireValue(factType, "factType is required");

  if (!FACT_TAXONOMY[factNamespace]?.has(factType)) {
    throw new PropertyFactError(
      `Unsupported fact key: ${factNamespace}.${factType}`
    );
  }

  return { factNamespace, factType };
};

const normalizeCreatedFrom = (value) => {
  const createdFrom = value || "manual";
  if (!CREATED_FROM_VALUES.has(createdFrom)) {
    throw new PropertyFactError(`Unsupported createdFrom: ${createdFrom}`);
  }
  return createdFrom;
};

const normalizeVerificationStatus = (createdFrom, requestedStatus) => {
  if (DOCUMENT_DERIVED_CREATED_FROM.has(createdFrom)) {
    return "suggested";
  }

  const verificationStatus = requestedStatus || "user_confirmed";
  if (!VERIFICATION_STATUSES.has(verificationStatus)) {
    throw new PropertyFactError(
      `Unsupported verificationStatus: ${verificationStatus}`
    );
  }
  return verificationStatus;
};

const normalizeFactPayload = (payload = {}) => {
  const { factNamespace, factType } = normalizeFactKey(payload);
  const valueJson =
    payload.valueJson !== undefined ? payload.valueJson : payload.value;
  requireValue(valueJson, "valueJson is required");

  const createdFrom = normalizeCreatedFrom(
    payload.createdFrom || payload.created_from
  );

  return {
    fact_namespace: factNamespace,
    fact_type: factType,
    value_json: valueJson,
    display_value: payload.displayValue || payload.display_value || null,
    unit: payload.unit || null,
    valid_from: normalizeOptionalDate(
      payload.validFrom || payload.valid_from,
      "validFrom"
    ),
    valid_to: normalizeOptionalDate(payload.validTo || payload.valid_to, "validTo"),
    observed_at: payload.observedAt || payload.observed_at || new Date(),
    is_current: payload.isCurrent !== false && payload.is_current !== false,
    confidence: normalizeConfidence(payload.confidence),
    verification_status: normalizeVerificationStatus(
      createdFrom,
      payload.verificationStatus || payload.verification_status
    ),
    created_from: createdFrom,
  };
};

const normalizeEvidencePayload = (payload = {}) => {
  const hasDocumentSource =
    payload.propertyDocumentId ||
    payload.property_document_id ||
    payload.userDocumentId ||
    payload.user_document_id;
  const sourceType =
    payload.sourceType ||
    payload.source_type ||
    (hasDocumentSource ? "user_document" : "manual");
  const extractionMethod =
    payload.extractionMethod || payload.extraction_method || "manual";

  if (!EVIDENCE_SOURCE_TYPES.has(sourceType)) {
    throw new PropertyFactError(`Unsupported sourceType: ${sourceType}`);
  }
  if (!EXTRACTION_METHODS.has(extractionMethod)) {
    throw new PropertyFactError(
      `Unsupported extractionMethod: ${extractionMethod}`
    );
  }

  const propertyDocumentId =
    payload.propertyDocumentId || payload.property_document_id || null;
  const userDocumentId = payload.userDocumentId || payload.user_document_id || null;
  const sourceName = payload.sourceName || payload.source_name || null;
  const sourceUrl = payload.sourceUrl || payload.source_url || null;

  if (!propertyDocumentId && !userDocumentId && !sourceName && !sourceUrl) {
    throw new PropertyFactError(
      "Evidence source requires propertyDocumentId, userDocumentId, sourceName or sourceUrl"
    );
  }

  return {
    property_document_id: propertyDocumentId
      ? toIntegerId(propertyDocumentId, "propertyDocumentId")
      : null,
    user_document_id: userDocumentId
      ? toIntegerId(userDocumentId, "userDocumentId")
      : null,
    source_type: sourceType,
    source_name: sourceName,
    source_url: sourceUrl,
    source_date: normalizeOptionalDate(
      payload.sourceDate || payload.source_date,
      "sourceDate"
    ),
    extraction_method: extractionMethod,
    excerpt: payload.excerpt || null,
    page_number:
      payload.pageNumber || payload.page_number
        ? toIntegerId(payload.pageNumber || payload.page_number, "pageNumber")
        : null,
    locator: payload.locator || null,
    confidence: normalizeConfidence(payload.confidence),
  };
};

const toEvidenceSourceResponse = (evidenceSource) => {
  if (!evidenceSource) return null;
  return {
    id: evidenceSource.id,
    propertyId: evidenceSource.property_id,
    propertyDocumentId: evidenceSource.property_document_id,
    userDocumentId: evidenceSource.user_document_id,
    sourceType: evidenceSource.source_type,
    sourceName: evidenceSource.source_name,
    sourceUrl: evidenceSource.source_url,
    sourceDate: evidenceSource.source_date,
    extractionMethod: evidenceSource.extraction_method,
    extractedByUserId: evidenceSource.extracted_by_user_id,
    excerpt: evidenceSource.excerpt,
    pageNumber: evidenceSource.page_number,
    locator: evidenceSource.locator,
    confidence: evidenceSource.confidence,
    createdAt: evidenceSource.createdAt,
    updatedAt: evidenceSource.updatedAt,
  };
};

const toFactResponse = (fact, evidenceSource = null) => ({
  id: fact.id,
  propertyId: fact.property_id,
  evidenceSourceId: fact.evidence_source_id,
  factNamespace: fact.fact_namespace,
  factType: fact.fact_type,
  factKey: `${fact.fact_namespace}.${fact.fact_type}`,
  value: fact.value_json,
  displayValue: fact.display_value,
  unit: fact.unit,
  validFrom: fact.valid_from,
  validTo: fact.valid_to,
  observedAt: fact.observed_at,
  isCurrent: fact.is_current,
  confidence: fact.confidence,
  verificationStatus: fact.verification_status,
  createdFrom: fact.created_from,
  createdByUserId: fact.created_by_user_id,
  createdAt: fact.createdAt,
  updatedAt: fact.updatedAt,
  evidenceSource: toEvidenceSourceResponse(evidenceSource),
});

const groupFactsByNamespace = (facts) =>
  facts.reduce((grouped, fact) => {
    if (!grouped[fact.factNamespace]) grouped[fact.factNamespace] = {};
    if (!grouped[fact.factNamespace][fact.factType]) {
      grouped[fact.factNamespace][fact.factType] = [];
    }
    grouped[fact.factNamespace][fact.factType].push(fact);
    return grouped;
  }, {});

const mapFactsWithEvidence = async (facts, options = {}) => {
  const evidenceSourceIds = facts
    .map((fact) => fact.evidence_source_id)
    .filter(Boolean);
  const evidenceSources = evidenceSourceIds.length
    ? await EvidenceSource.findAll({
        where: { id: evidenceSourceIds },
        transaction: options.transaction,
      })
    : [];
  const evidenceById = new Map(
    evidenceSources.map((source) => [source.id, source])
  );

  return facts.map((fact) =>
    toFactResponse(fact, evidenceById.get(fact.evidence_source_id))
  );
};

const findLinkedPropertyDocument = async (propertyId, propertyDocumentId, options = {}) =>
  PropertyDocument.findOne({
    where: {
      id: propertyDocumentId,
      property_id: propertyId,
      is_active: true,
    },
    transaction: options.transaction,
  });

class PropertyFactService {
  static async listCurrentFactsForProperty(propertyId, options = {}) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");
    const facts = await PropertyFact.findAll({
      where: {
        property_id: normalizedPropertyId,
        is_current: true,
      },
      order: [
        ["fact_namespace", "ASC"],
        ["fact_type", "ASC"],
        ["updatedAt", "DESC"],
      ],
      transaction: options.transaction,
    });
    const mappedFacts = await mapFactsWithEvidence(facts, options);

    return {
      facts: mappedFacts,
      groupedFacts: groupFactsByNamespace(mappedFacts),
    };
  }

  static async listPropertyFacts(userId, propertyId, options = {}) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");
    await requirePropertyPermission(
      userId,
      normalizedPropertyId,
      READ_PERMISSION_LEVELS,
      options
    );
    return this.listCurrentFactsForProperty(normalizedPropertyId, options);
  }

  static async createEvidenceSource(userId, propertyId, payload = {}, options = {}) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");
    const evidencePayload = normalizeEvidencePayload(payload);

    await requirePropertyPermission(
      userId,
      normalizedPropertyId,
      CONTRIBUTOR_PERMISSION_LEVELS,
      options
    );

    let userDocumentId = evidencePayload.user_document_id;
    let propertyDocumentId = evidencePayload.property_document_id;
    if (evidencePayload.property_document_id) {
      const propertyDocument = await findLinkedPropertyDocument(
        normalizedPropertyId,
        evidencePayload.property_document_id,
        options
      );

      if (!propertyDocument) {
        throw new PropertyFactError("Linked property document not found", 404);
      }
      userDocumentId = propertyDocument.user_document_id;
    } else if (userDocumentId) {
      const propertyDocument = await PropertyDocument.findOne({
        where: {
          property_id: normalizedPropertyId,
          user_document_id: userDocumentId,
          is_active: true,
        },
        transaction: options.transaction,
      });

      if (!propertyDocument) {
        throw new PropertyFactError("Linked property document not found", 404);
      }
      propertyDocumentId = propertyDocument.id;
    }

    if (userDocumentId) {
      const userDocument = await UserDocument.findOne({
        where: {
          id: userDocumentId,
          is_active: true,
        },
        transaction: options.transaction,
      });

      if (!userDocument) {
        throw new PropertyFactError("User document not found", 404);
      }
      if (!evidencePayload.source_name) {
        evidencePayload.source_name = userDocument.name;
      }
    }

    const evidenceSource = await EvidenceSource.create(
      {
        ...evidencePayload,
        property_id: normalizedPropertyId,
        property_document_id: propertyDocumentId,
        user_document_id: userDocumentId,
        extracted_by_user_id: userId,
      },
      { transaction: options.transaction }
    );

    return toEvidenceSourceResponse(evidenceSource);
  }

  static async createPropertyFact(userId, propertyId, payload = {}) {
    const normalizedPropertyId = toIntegerId(propertyId, "propertyId");

    return sequelize.transaction(async (transaction) => {
      await requirePropertyPermission(
        userId,
        normalizedPropertyId,
        CONTRIBUTOR_PERMISSION_LEVELS,
        { transaction }
      );

      const factPayload = normalizeFactPayload(payload);
      let evidenceSourceId =
        payload.evidenceSourceId || payload.evidence_source_id || null;

      if (payload.evidenceSource || payload.evidence_source) {
        const evidenceSource = await this.createEvidenceSource(
          userId,
          normalizedPropertyId,
          payload.evidenceSource || payload.evidence_source,
          { transaction }
        );
        evidenceSourceId = evidenceSource.id;
      }

      let evidenceSource = null;
      if (evidenceSourceId) {
        const normalizedEvidenceSourceId = toIntegerId(
          evidenceSourceId,
          "evidenceSourceId"
        );
        evidenceSource = await EvidenceSource.findOne({
          where: {
            id: normalizedEvidenceSourceId,
            property_id: normalizedPropertyId,
          },
          transaction,
        });

        if (!evidenceSource) {
          throw new PropertyFactError("Evidence source not found", 404);
        }
        evidenceSourceId = normalizedEvidenceSourceId;
      }

      if (factPayload.is_current) {
        await PropertyFact.update(
          { is_current: false },
          {
            where: {
              property_id: normalizedPropertyId,
              fact_namespace: factPayload.fact_namespace,
              fact_type: factPayload.fact_type,
              is_current: true,
            },
            transaction,
          }
        );
      }

      const fact = await PropertyFact.create(
        {
          ...factPayload,
          property_id: normalizedPropertyId,
          evidence_source_id: evidenceSourceId,
          created_by_user_id: userId,
        },
        { transaction }
      );

      return toFactResponse(fact, evidenceSource);
    });
  }
}

PropertyFactService.PropertyFactError = PropertyFactError;
PropertyFactService.FACT_TAXONOMY = FACT_TAXONOMY;

module.exports = PropertyFactService;
