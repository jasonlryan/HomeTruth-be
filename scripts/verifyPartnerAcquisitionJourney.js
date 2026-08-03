const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CONSENT_SCOPE_RULES,
  buildAcquisitionPresentation,
  consentContractForResponse,
  normalizeAcquisitionConfig,
  normalizeConsentConfig,
} = require("../services/partnerAcquisitionContract");

const partnerTypes = [
  "insurer",
  "mortgage_provider",
  "home_developer",
  "other",
];

const expectedScopes = [
  "hometruth_processing",
  "aggregate_analytics",
  "partner_reporting",
  "partner_contact_servicing",
];

assert.deepEqual(
  CONSENT_SCOPE_RULES.map(({ scope }) => scope),
  expectedScopes
);
assert.equal(
  CONSENT_SCOPE_RULES.find(({ scope }) => scope === "hometruth_processing")
    .required,
  true
);
assert.equal(
  CONSENT_SCOPE_RULES.filter(({ required }) => required === false).length,
  3
);
assert.equal(
  CONSENT_SCOPE_RULES.some(({ scope }) => scope === "individual_report_access"),
  false
);

for (const partnerType of partnerTypes) {
  const presentation = buildAcquisitionPresentation({
    partner: { name: `${partnerType} partner`, partner_type: partnerType },
    programme: { name: `${partnerType} programme` },
    campaign: {
      name: `${partnerType} campaign`,
      acquisition_config: {
        headline: `Approved ${partnerType} homeowner headline`,
        support: { label: "HomeTruth support", url: "/faq" },
      },
      consent_config: { version: `${partnerType}-v1` },
    },
    cohort: { name: `${partnerType} cohort` },
  });

  assert.equal(presentation.partnerType, partnerType);
  assert.equal(presentation.programmeName, `${partnerType} programme`);
  assert.equal(presentation.campaignName, `${partnerType} campaign`);
  assert.equal(presentation.consentContract.version, `${partnerType}-v1`);
  assert.deepEqual(
    presentation.consentContract.scopes.map(({ scope }) => scope),
    expectedScopes
  );
  assert.ok(
    presentation.consentContract.scopes.every(({ textHash }) =>
      /^[a-f0-9]{64}$/.test(textHash)
    )
  );
}

assert.throws(
  () => normalizeAcquisitionConfig({ support: { url: "javascript:alert(1)" } }),
  /internal path, HTTPS URL or mailto/
);
assert.throws(
  () => normalizeAcquisitionConfig({ support: { url: "//example.com/tracker" } }),
  /internal path, HTTPS URL or mailto/
);
assert.throws(
  () =>
    normalizeAcquisitionConfig({
      partnerLogo: { url: "mailto:tracking@example.com", alt: "Partner" },
    }),
  /internal path, HTTPS URL or mailto/
);
assert.throws(
  () => normalizeAcquisitionConfig({ setupExpectations: [] }),
  /at least 1 item/
);
assert.throws(
  () =>
    normalizeConsentConfig({
      scopes: [{ scope: "hometruth_processing", required: false }],
    }),
  /required status is fixed/
);
assert.throws(
  () => normalizeConsentConfig({ scopes: [{ scope: "individual_report_access" }] }),
  /Unsupported acquisition consent scope/
);

const contract = consentContractForResponse({ version: "server-v1" });
assert.equal(contract.version, "server-v1");
assert.equal(new Set(contract.scopes.map(({ textHash }) => textHash)).size, 4);

const onboardingSource = fs.readFileSync(
  path.join(__dirname, "../services/partnerOnboardingService.js"),
  "utf8"
);
const routesSource = fs.readFileSync(
  path.join(__dirname, "../routes/partnerOnboardingRoutes.js"),
  "utf8"
);

assert.match(onboardingSource, /const consentVersion = consentContract\.version/);
assert.match(onboardingSource, /consent_text_hash: definition\.textHash/);
assert.doesNotMatch(onboardingSource, /payload\.consentVersion/);
assert.match(onboardingSource, /metadata: \{ path: safePath \}/);
assert.ok(
  routesSource.indexOf("router.use(authMiddleware)") <
    routesSource.indexOf('router.post("/events"')
);

console.log(
  "Partner acquisition contract checks passed for insurer, mortgage provider, home developer and other"
);
