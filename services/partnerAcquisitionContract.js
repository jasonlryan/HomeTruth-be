const crypto = require("node:crypto");

const CONSENT_SCOPE_RULES = [
  {
    scope: "hometruth_processing",
    required: true,
    label: "Use HomeTruth for your home",
    summary:
      "Allows HomeTruth to create and manage the property record, documents and actions you choose to add.",
  },
  {
    scope: "aggregate_analytics",
    required: false,
    label: "Include my use in aggregate programme analytics",
    summary:
      "Allows de-identified activity to contribute to grouped programme measures. No individual property record is shown to the partner.",
  },
  {
    scope: "partner_reporting",
    required: false,
    label: "Include my progress in aggregate partner reporting",
    summary:
      "Allows HomeTruth to include your activity in thresholded programme totals shared with the sponsoring partner.",
  },
  {
    scope: "partner_contact_servicing",
    required: false,
    label: "Allow programme follow-up from the partner",
    summary:
      "Allows the sponsoring partner to contact you about this programme. It does not grant access to your HomeTruth records.",
  },
];

const CONSENT_SCOPES = new Set(CONSENT_SCOPE_RULES.map(({ scope }) => scope));

class PartnerAcquisitionContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "PartnerAcquisitionContractError";
    this.statusCode = 400;
  }
}

const value = (record, field) => record?.[field] ?? record?.dataValues?.[field];

const asObject = (input) => {
  if (!input) return {};
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }
  return typeof input === "object" && !Array.isArray(input) ? input : {};
};

const cleanText = (input, field, maxLength, fallback = "") => {
  if (input === undefined || input === null || input === "") return fallback;
  if (typeof input !== "string") {
    throw new PartnerAcquisitionContractError(`${field} must be plain text`);
  }
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  if (normalized.length > maxLength) {
    throw new PartnerAcquisitionContractError(
      `${field} must be ${maxLength} characters or fewer`
    );
  }
  return normalized;
};

const cleanUrl = (
  input,
  field,
  fallback = null,
  { allowMailto = true } = {}
) => {
  if (input === undefined || input === null || input === "") return fallback;
  const normalized = cleanText(input, field, 500);
  const allowedInternalPath =
    normalized.startsWith("/") && !normalized.startsWith("//");
  const allowed =
    allowedInternalPath ||
    normalized.startsWith("https://") ||
    (allowMailto && normalized.startsWith("mailto:"));
  if (!allowed) {
    throw new PartnerAcquisitionContractError(
      `${field} must be an internal path, HTTPS URL or mailto link`
    );
  }
  return normalized;
};

const cleanStringArray = (input, field, fallback) => {
  if (input === undefined || input === null) return fallback;
  if (!Array.isArray(input)) {
    throw new PartnerAcquisitionContractError(`${field} must be an array`);
  }
  if (input.length > 6) {
    throw new PartnerAcquisitionContractError(`${field} must contain at most 6 items`);
  }
  if (!input.length) {
    throw new PartnerAcquisitionContractError(`${field} must contain at least 1 item`);
  }
  return input.map((item, index) => {
    const normalized = cleanText(item, `${field}[${index}]`, 220);
    if (!normalized) {
      throw new PartnerAcquisitionContractError(
        `${field}[${index}] must be plain text`
      );
    }
    return normalized;
  });
};

const normalizeAcquisitionConfig = (input = {}) => {
  const config = asObject(input);
  const support = asObject(config.support);
  const partnerLogo = asObject(config.partnerLogo);
  return {
    eyebrow: cleanText(config.eyebrow, "acquisitionConfig.eyebrow", 100, "A HomeTruth partner programme"),
    headline: cleanText(
      config.headline,
      "acquisitionConfig.headline",
      180,
      "Everything about your home, clearer and easier to manage"
    ),
    homeownerPromise: cleanText(
      config.homeownerPromise,
      "acquisitionConfig.homeownerPromise",
      500,
      "Build a useful record of your home, understand important documents and keep practical actions in one place."
    ),
    setupExpectations: cleanStringArray(
      config.setupExpectations,
      "acquisitionConfig.setupExpectations",
      [
        "Create or sign in to your HomeTruth account",
        "Choose what programme permissions you want to grant",
        "Connect an existing property or start a new home record",
      ]
    ),
    privacySummary: cleanText(
      config.privacySummary,
      "acquisitionConfig.privacySummary",
      500,
      "Your HomeTruth record stays under your control. The partner receives no individual property, document or task data through this journey."
    ),
    support: {
      label: cleanText(support.label, "acquisitionConfig.support.label", 100, "Get help from HomeTruth"),
      url: cleanUrl(support.url, "acquisitionConfig.support.url", "/faq"),
    },
    partnerLogo:
      partnerLogo.url
        ? {
            url: cleanUrl(
              partnerLogo.url,
              "acquisitionConfig.partnerLogo.url",
              null,
              { allowMailto: false }
            ),
            alt: cleanText(partnerLogo.alt, "acquisitionConfig.partnerLogo.alt", 140, "Partner logo"),
          }
        : null,
  };
};

const normalizeConsentConfig = (input = {}) => {
  const config = asObject(input);
  const version = cleanText(
    config.version,
    "consentConfig.version",
    80,
    "partner-acquisition-v1"
  );
  if (config.scopes !== undefined && !Array.isArray(config.scopes)) {
    throw new PartnerAcquisitionContractError("consentConfig.scopes must be an array");
  }
  const suppliedScopes = config.scopes || [];
  const suppliedByScope = new Map();

  for (const supplied of suppliedScopes) {
    const item = asObject(supplied);
    if (!CONSENT_SCOPES.has(item.scope)) {
      throw new PartnerAcquisitionContractError(
        `Unsupported acquisition consent scope: ${item.scope || "missing"}`
      );
    }
    if (suppliedByScope.has(item.scope)) {
      throw new PartnerAcquisitionContractError(
        `Duplicate acquisition consent scope: ${item.scope}`
      );
    }
    suppliedByScope.set(item.scope, item);
  }

  const scopes = CONSENT_SCOPE_RULES.map((rule) => {
    const supplied = suppliedByScope.get(rule.scope) || {};
    if (supplied.required !== undefined && Boolean(supplied.required) !== rule.required) {
      throw new PartnerAcquisitionContractError(
        `${rule.scope} required status is fixed by the HomeTruth consent boundary`
      );
    }
    return {
      scope: rule.scope,
      required: rule.required,
      label: cleanText(
        supplied.label,
        `consentConfig.${rule.scope}.label`,
        180,
        rule.label
      ),
      summary: cleanText(
        supplied.summary,
        `consentConfig.${rule.scope}.summary`,
        500,
        rule.summary
      ),
    };
  });

  return { version, scopes };
};

const consentTextHash = (version, definition) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        version,
        scope: definition.scope,
        required: definition.required,
        label: definition.label,
        summary: definition.summary,
      })
    )
    .digest("hex");

const consentContractForResponse = (input = {}) => {
  const normalized = normalizeConsentConfig(input);
  return {
    version: normalized.version,
    scopes: normalized.scopes.map((definition) => ({
      ...definition,
      textHash: consentTextHash(normalized.version, definition),
    })),
  };
};

const buildAcquisitionPresentation = ({ partner, programme, campaign, cohort }) => {
  const acquisition = normalizeAcquisitionConfig(value(campaign, "acquisition_config"));
  const consentContract = consentContractForResponse(value(campaign, "consent_config"));
  return {
    ...acquisition,
    partnerName: value(partner, "name"),
    partnerType: value(partner, "partner_type"),
    programmeName: value(programme, "name") || null,
    campaignName: value(campaign, "name") || null,
    cohortName: value(cohort, "name"),
    productName: "HomeTruth",
    consentContract,
  };
};

module.exports = {
  CONSENT_SCOPE_RULES,
  CONSENT_SCOPES,
  PartnerAcquisitionContractError,
  buildAcquisitionPresentation,
  consentContractForResponse,
  consentTextHash,
  normalizeAcquisitionConfig,
  normalizeConsentConfig,
};
