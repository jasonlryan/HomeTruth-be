const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const modelsPath = require.resolve("../models");
const databasePath = require.resolve("../config/database");
const servicePath = require.resolve("../services/partnerProgrammeService");

const partners = [];
const programmes = [];
const campaigns = [];
const cohorts = [];
const auditEvents = [];
let nextId = 1;

const record = (values) => ({
  ...values,
  createdAt: values.createdAt || new Date(),
  updatedAt: values.updatedAt || new Date(),
  async update(changes) {
    Object.assign(this, changes, { updatedAt: new Date() });
    return this;
  },
});

const matches = (item, where = {}) =>
  Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === "object") return true;
    return item[key] === expected;
  });

const hydrateProgramme = (programme) => {
  programme.Partner = partners.find((partner) => partner.id === programme.partner_id);
  programme.PartnerCampaigns = campaigns.filter(
    (campaign) => campaign.partner_programme_id === programme.id
  );
  programme.PartnerCohorts = cohorts.filter(
    (cohort) => cohort.partner_programme_id === programme.id
  );
  programme.PartnerProgrammeAuditEvents = auditEvents
    .filter((event) => event.partner_programme_id === programme.id)
    .sort((left, right) => right.occurred_at - left.occurred_at);
  return programme;
};

const model = (collection) => ({
  async create(values) {
    const created = record({ id: nextId++, ...values });
    collection.push(created);
    return created;
  },
  async findByPk(id) {
    const found = collection.find((item) => item.id === Number(id)) || null;
    return collection === programmes && found ? hydrateProgramme(found) : found;
  },
  async findAll({ where = {} } = {}) {
    const found = collection.filter((item) => matches(item, where));
    return collection === programmes ? found.map(hydrateProgramme) : found;
  },
  async count({ where = {} } = {}) {
    return collection.filter((item) => matches(item, where)).length;
  },
  async update(values, { where = {} } = {}) {
    const found = collection.filter((item) => matches(item, where));
    found.forEach((item) => Object.assign(item, values, { updatedAt: new Date() }));
    return [found.length];
  },
});

const Partner = model(partners);
const PartnerProgramme = model(programmes);
const PartnerCampaign = model(campaigns);
const PartnerCohort = model(cohorts);
const PartnerProgrammeAuditEvent = model(auditEvents);

const originalModels = require.cache[modelsPath];
const originalDatabase = require.cache[databasePath];
require.cache[modelsPath] = {
  id: modelsPath,
  filename: modelsPath,
  loaded: true,
  exports: {
    Partner,
    PartnerProgramme,
    PartnerCampaign,
    PartnerCohort,
    PartnerProgrammeAuditEvent,
    User: {
      findOne: async ({ where }) =>
        where.id === 900 && where.role === "admin" ? { id: 900, role: "admin" } : null,
    },
  },
};
require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: {
    transaction: async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }),
  },
};
delete require.cache[servicePath];

const PartnerProgrammeService = require("../services/partnerProgrammeService");

const basePayload = (partnerType, sequence) => ({
  partner: {
    name: `${partnerType} partner`,
    partnerType,
    externalRef: `opaque-${sequence}`,
  },
  programmeKey: `programme-${sequence}`,
  name: `${partnerType} homeowner programme`,
  startDate: "2026-09-01",
  endDate: "2027-08-31",
  entitlement: { pack: "shared_core", seats: 500 },
  inviteMode: "both",
  approvedContentRefs: ["copy/homeowner-promise-v1"],
  campaign: {
    campaignKey: `campaign-${sequence}`,
    name: "Autumn invitation",
    inviteRoute: `/partner/programme-${sequence}`,
    approvedContentRef: "copy/invitation-v1",
    startDate: "2026-09-01",
    endDate: "2026-11-30",
  },
  cohort: {
    cohortKey: `cohort-${sequence}`,
    name: "Autumn cohort",
    targetSize: 500,
    startDate: "2026-09-01",
    endDate: "2027-08-31",
  },
});

(async () => {
  const partnerTypes = [
    "insurer",
    "mortgage_provider",
    "home_developer",
    "other",
  ];
  const created = [];
  for (const [index, partnerType] of partnerTypes.entries()) {
    const programme = await PartnerProgrammeService.createProgramme(
      basePayload(partnerType, index + 1),
      900
    );
    assert.equal(programme.partner.partnerType, partnerType);
    assert.equal(programme.partner.reportingMode, "aggregate_only");
    assert.equal(programme.status, "draft");
    assert.equal(programme.campaigns.length, 1);
    assert.equal(programme.cohorts.length, 1);
    created.push(programme);
  }

  const list = await PartnerProgrammeService.listProgrammes();
  assert.equal(list.length, 4);
  assert.deepEqual(
    new Set(list.map((programme) => programme.partner.partnerType)),
    new Set(partnerTypes)
  );

  const firstId = created[0].id;
  let first = await PartnerProgrammeService.transitionProgramme(firstId, "active", 900);
  assert.equal(first.status, "active");
  assert.equal(first.campaigns[0].status, "active");
  assert.equal(first.cohorts[0].status, "active");

  first = await PartnerProgrammeService.transitionProgramme(firstId, "paused", 900);
  assert.equal(first.status, "paused");
  assert.equal(first.campaigns[0].status, "paused");
  assert.equal(first.cohorts[0].status, "paused");

  first = await PartnerProgrammeService.updateProgramme(
    firstId,
    { entitlement: { pack: "shared_core", seats: 750 } },
    900
  );
  assert.equal(first.entitlement.seats, 750);

  first = await PartnerProgrammeService.transitionProgramme(firstId, "closed", 900);
  assert.equal(first.status, "closed");
  assert.equal(first.campaigns[0].status, "closed");
  assert.equal(first.cohorts[0].status, "closed");
  assert.ok(first.auditEvents.some((event) => event.eventType === "status_changed"));

  await assert.rejects(
    () => PartnerProgrammeService.transitionProgramme(firstId, "active", 900),
    /cannot transition from closed to active/
  );
  await assert.rejects(
    () =>
      PartnerProgrammeService.createProgramme(
        { ...basePayload("other", 10), startDate: "2027-01-01", endDate: "2026-01-01" },
        900
      ),
    /start date must not be after/
  );
  await assert.rejects(
    () => PartnerProgrammeService.createProgramme(basePayload("bank", 11), 900),
    /partnerType must be/
  );

  const incomplete = await PartnerProgrammeService.createProgramme(
    {
      partner: { name: "Configuration-only partner", partnerType: "other" },
      programmeKey: "incomplete-programme",
      name: "Incomplete programme",
    },
    900
  );
  await assert.rejects(
    () => PartnerProgrammeService.transitionProgramme(incomplete.id, "active", 900),
    /requires at least one campaign and cohort/
  );

  const serialized = JSON.stringify(await PartnerProgrammeService.getProgramme(firstId));
  for (const prohibitedCollection of [
    "members",
    "users",
    "properties",
    "documents",
    "tasks",
    "consentRecords",
    "pilotEvents",
  ]) {
    assert.equal(serialized.includes(`\"${prohibitedCollection}\"`), false);
  }

  const routeSource = fs.readFileSync(
    path.join(root, "routes/admin/adminPartnerProgrammeRoutes.js"),
    "utf8"
  );
  assert.ok(
    routeSource.indexOf("router.use(authMiddleware)") <
      routeSource.indexOf('router.get("/partners"'),
    "authentication must run before partner-programme routes"
  );
  assert.ok(
    routeSource.indexOf('router.use(checkRole(["admin"]))') <
      routeSource.indexOf('router.post("/programmes"'),
    "admin authorization must run before partner-programme writes"
  );

  const checkRole = require("../Middleware/checkRole");
  let nextCalled = false;
  let responseStatus = null;
  checkRole(["admin"])(
    { user: { role: "user" } },
    {
      status(status) {
        responseStatus = status;
        return this;
      },
      json() {},
    },
    () => {
      nextCalled = true;
    }
  );
  assert.equal(responseStatus, 403);
  assert.equal(nextCalled, false);

  console.log("Partner programme lifecycle checks passed");
})()
  .finally(() => {
    delete require.cache[servicePath];
    if (originalModels) require.cache[modelsPath] = originalModels;
    else delete require.cache[modelsPath];
    if (originalDatabase) require.cache[databasePath] = originalDatabase;
    else delete require.cache[databasePath];
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
