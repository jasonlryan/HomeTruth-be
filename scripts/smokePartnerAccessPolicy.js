const assert = require("assert");
const sequelize = require("../config/database");
const {
  Partner,
  PartnerAccessAuditEvent,
  PartnerProgramme,
  PartnerProgrammeAccess,
  PartnerProgrammeAuditEvent,
  User,
} = require("../models");
const PartnerAccessService = require("../services/partnerAccessService");

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const created = { userIds: [], partnerIds: [], programmeIds: [] };

const cleanup = async () => {
  if (created.programmeIds.length) {
    await PartnerAccessAuditEvent.destroy({
      where: { partner_programme_id: created.programmeIds },
      force: true,
    });
    await PartnerProgrammeAccess.destroy({
      where: { partner_programme_id: created.programmeIds },
      force: true,
    });
    await PartnerProgramme.destroy({ where: { id: created.programmeIds }, force: true });
  }
  if (created.partnerIds.length) {
    await Partner.destroy({ where: { id: created.partnerIds }, force: true });
  }
  if (created.userIds.length) {
    await User.destroy({ where: { id: created.userIds }, force: true });
  }
};

const expectDenied = async (promise) => {
  await assert.rejects(promise, (error) => error.statusCode === 403);
};

const main = async () => {
  await sequelize.authenticate();
  const admin = await User.create({
    email: `ht332-admin-${suffix}@example.com`,
    password: "HT332-test-password!",
    role: "admin",
    is_verified: true,
  });
  created.userIds.push(admin.id);

  const types = ["insurer", "mortgage_provider", "home_developer", "other"];
  const roles = ["sponsor", "programme_manager", "analyst", "privacy_auditor"];
  const fixtures = [];

  for (let index = 0; index < types.length; index += 1) {
    const staff = await User.create({
      email: `ht332-${roles[index]}-${suffix}@example.com`,
      password: "HT332-test-password!",
      role: "user",
      is_verified: true,
    });
    created.userIds.push(staff.id);
    const partner = await Partner.create({
      name: `HT332 ${types[index]} ${suffix}`,
      partner_type: types[index],
      status: "active",
      reporting_mode: "aggregate_only",
    });
    created.partnerIds.push(partner.id);
    const programme = await PartnerProgramme.create({
      partner_id: partner.id,
      programme_key: `ht332-${index}-${suffix}`.slice(0, 120),
      name: `HT332 ${roles[index]} programme`,
      status: "active",
      owner_user_id: admin.id,
      entitlement: {},
      invite_mode: "cohort_code",
      approved_content_refs: [],
      created_by_user_id: admin.id,
      updated_by_user_id: admin.id,
      activated_at: new Date(),
    });
    created.programmeIds.push(programme.id);
    const assignment = await PartnerAccessService.grantAccess(
      programme.id,
      { userEmail: staff.email, role: roles[index] },
      admin.id
    );
    assert.equal(assignment.status, "active");
    fixtures.push({ staff, partner, programme, role: roles[index], assignment });
  }

  for (const fixture of fixtures) {
    const list = await PartnerAccessService.listMyProgrammes(fixture.staff.id);
    assert.equal(list.length, 1);
    assert.equal(list[0].partner.partnerType, fixture.partner.partner_type);
    assert.equal(list[0].programme.id, fixture.programme.id);
    const detail = await PartnerAccessService.getProgramme(
      fixture.staff.id,
      fixture.programme.id
    );
    assert.equal(detail.role, fixture.role);
    assert.equal(JSON.stringify(detail).includes(fixture.staff.email), false);
  }

  await assert.rejects(
    PartnerAccessService.grantAccess(
      fixtures[0].programme.id,
      { userEmail: fixtures[0].staff.email, role: fixtures[0].role },
      admin.id
    ),
    (error) => error.statusCode === 409
  );

  await expectDenied(
    PartnerAccessService.getProgramme(
      fixtures[0].staff.id,
      fixtures[1].programme.id
    )
  );
  await expectDenied(
    PartnerAccessService.denyIndividualResource(
      fixtures[1].staff.id,
      fixtures[1].programme.id,
      "properties"
    )
  );

  const manager = fixtures[1];
  await PartnerProgrammeAuditEvent.create({
    partner_programme_id: manager.programme.id,
    actor_user_id: admin.id,
    event_type: "status_changed",
    previous_status: "paused",
    new_status: "active",
    changes: {},
    occurred_at: new Date(),
  });
  const managerAudit = await PartnerAccessService.getAuditEvents(
    manager.staff.id,
    manager.programme.id
  );
  assert(managerAudit.some((event) => event.eventType === "access_granted"));
  assert(
    managerAudit.some(
      (event) =>
        event.action === "programme:status_changed" &&
        event.actorType === "hometruth_operator"
    )
  );
  assert(managerAudit.every((event) => !JSON.stringify(event).includes(manager.staff.email)));

  const analyst = fixtures[2];
  await PartnerAccessService.changeRole(
    analyst.programme.id,
    analyst.assignment.id,
    "programme_manager",
    admin.id
  );
  const changedAudit = await PartnerAccessService.getAuditEvents(
    analyst.staff.id,
    analyst.programme.id
  );
  assert(changedAudit.some((event) => event.eventType === "access_role_changed"));

  await analyst.programme.update({ status: "paused", paused_at: new Date() });
  await expectDenied(
    PartnerAccessService.getProgramme(analyst.staff.id, analyst.programme.id)
  );
  const historicalAudit = await PartnerAccessService.getAuditEvents(
    analyst.staff.id,
    analyst.programme.id
  );
  assert(historicalAudit.some((event) => event.reasonCode === "programme_inactive"));

  const sponsor = fixtures[0];
  await PartnerAccessService.revokeAccess(
    sponsor.programme.id,
    sponsor.assignment.id,
    admin.id
  );
  assert.equal((await PartnerAccessService.listMyProgrammes(sponsor.staff.id)).length, 0);
  await expectDenied(
    PartnerAccessService.getProgramme(sponsor.staff.id, sponsor.programme.id)
  );

  const auditCount = await PartnerAccessAuditEvent.count({
    where: { partner_programme_id: created.programmeIds },
  });
  assert(auditCount >= 12, "expected grant, view, denial, role and revoke audit evidence");

  console.log(
    "Partner access MySQL smoke passed for all four partner types and roles, grant/change/revoke, duplicate and cross-programme denial, lifecycle enforcement, explicit individual-resource denial, audit evidence and privacy-safe responses."
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } finally {
      await sequelize.close();
    }
  });
