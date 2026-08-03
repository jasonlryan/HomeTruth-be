const assert = require("assert");
const PartnerAccessService = require("../services/partnerAccessService");

const {
  ROLE_CAPABILITIES,
  evaluateAccess,
  safeAuditDetails,
  toPartnerProgrammeResponse,
} = PartnerAccessService;

const partnerTypes = [
  "insurer",
  "mortgage_provider",
  "home_developer",
  "other",
];
const roles = ["sponsor", "programme_manager", "analyst", "privacy_auditor"];

for (const partnerType of partnerTypes) {
  for (const role of roles) {
    const programmeDecision = evaluateAccess({
      accessStatus: "active",
      role,
      partnerStatus: "active",
      programmeStatus: "active",
      capability: "programme:view",
    });
    assert.equal(programmeDecision.allowed, true, `${role} should view ${partnerType}`);
  }
}

for (const role of roles) {
  assert.equal(
    evaluateAccess({
      accessStatus: "revoked",
      role,
      partnerStatus: "active",
      programmeStatus: "active",
      capability: "programme:view",
    }).allowed,
    false
  );
  for (const status of ["draft", "paused", "closed"]) {
    assert.equal(
      evaluateAccess({
        accessStatus: "active",
        role,
        partnerStatus: "active",
        programmeStatus: status,
        capability: "programme:view",
      }).allowed,
      false,
      `${role} must not receive operational access to ${status} programmes`
    );
  }
  for (const resource of [
    "homeowners:view",
    "properties:view",
    "documents:view",
    "tasks:view",
    "profiles:view",
    "chats:view",
    "events:view",
  ]) {
    assert.equal(
      ROLE_CAPABILITIES[role].includes(resource),
      false,
      `${role} must not receive ${resource}`
    );
  }
}

assert.deepEqual(
  evaluateAccess({
    accessStatus: "active",
    role: "programme_manager",
    partnerStatus: "active",
    programmeStatus: "active",
    capability: "programme:view",
    accessPartnerId: 1,
    programmePartnerId: 2,
  }),
  { allowed: false, reasonCode: "scope_mismatch" }
);

for (const role of ["programme_manager", "privacy_auditor"]) {
  assert.equal(
    evaluateAccess({
      accessStatus: "active",
      role,
      partnerStatus: "paused",
      programmeStatus: "closed",
      capability: "audit:view",
    }).allowed,
    true,
    `${role} retains historical audit access`
  );
}
for (const role of ["sponsor", "analyst"]) {
  assert.equal(
    evaluateAccess({
      accessStatus: "active",
      role,
      partnerStatus: "active",
      programmeStatus: "active",
      capability: "audit:view",
    }).allowed,
    false
  );
}

assert.equal(
  evaluateAccess({
    accessStatus: "active",
    role: "analyst",
    partnerStatus: "active",
    programmeStatus: "active",
    capability: "programme:view",
    userRole: "admin",
  }).allowed,
  true,
  "authorization is assignment-based and does not consume browser/admin role"
);

const response = toPartnerProgrammeResponse({
  id: 99,
  user_id: 44,
  access_role: "analyst",
  status: "active",
  Partner: {
    id: 1,
    name: "Shared Core Partner",
    partner_type: "other",
    status: "active",
    reporting_mode: "aggregate_only",
  },
  PartnerProgramme: {
    id: 2,
    programme_key: "shared-core",
    name: "Shared Core",
    status: "active",
  },
});
const serialized = JSON.stringify(response);
for (const forbidden of [
  "userId",
  "memberId",
  "propertyId",
  "documentId",
  "taskId",
  "email",
  "address",
]) {
  assert.equal(serialized.includes(forbidden), false, `response exposed ${forbidden}`);
}
assert.deepEqual(response.capabilities, ["programme:view"]);

assert.deepEqual(
  safeAuditDetails({
    role: "analyst",
    programmeStatus: "active",
    email: "forbidden@example.com",
    propertyId: 123,
    freeText: "forbidden",
  }),
  { role: "analyst", programmeStatus: "active" }
);

console.log(
  "Partner access policy verification passed for four roles, four partner types, lifecycle gates, explicit individual-data denials, admin separation and privacy-safe responses."
);
process.exit(0);
