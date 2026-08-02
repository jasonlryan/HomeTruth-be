const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const sequelize = require("../config/database");
const { Partner, User } = require("../models");
const PartnerOnboardingService = require("../services/partnerOnboardingService");
const PartnerProgrammeService = require("../services/partnerProgrammeService");

const token = randomUUID().replaceAll("-", "").slice(0, 12);
const partnerIds = [];
let actor = null;

const payloadFor = (partnerType, index) => ({
  partner: {
    name: `HT-329 ${partnerType} ${token}`,
    partnerType,
    externalRef: `ht329-${token}-${index}`,
  },
  programmeKey: `ht329-${token}-programme-${index}`,
  name: `HT-329 ${partnerType} programme`,
  startDate: "2026-09-01",
  endDate: "2027-08-31",
  entitlement: { pack: "shared_core", seats: 5 },
  inviteMode: "both",
  approvedContentRefs: ["copy/homeowner-promise-v1"],
  campaign: {
    campaignKey: `ht329-${token}-campaign-${index}`,
    name: "HT-329 smoke campaign",
    inviteRoute: `/partner/ht329-${token}-cohort-${index}`,
    approvedContentRef: "copy/invitation-v1",
    startDate: "2026-09-01",
    endDate: "2026-11-30",
  },
  cohort: {
    cohortKey: `ht329-${token}-cohort-${index}`,
    name: "HT-329 smoke cohort",
    targetSize: 5,
    startDate: "2026-09-01",
    endDate: "2027-08-31",
  },
});

(async () => {
  await sequelize.authenticate();
  actor = await User.create({
    first_name: "HT-329",
    last_name: "Smoke",
    email: `ht329-${token}@hometruth.local`,
    password: randomUUID(),
    role: "admin",
    is_verified: true,
  });

  const partnerTypes = [
    "insurer",
    "mortgage_provider",
    "home_developer",
    "other",
  ];
  const programmes = [];
  for (const [index, partnerType] of partnerTypes.entries()) {
    const payload = payloadFor(partnerType, index + 1);
    if (partnerType === "mortgage_provider") payload.inviteMode = "individual_invite";
    const programme = await PartnerProgrammeService.createProgramme(
      payload,
      actor.id
    );
    partnerIds.push(programme.partner.id);
    programmes.push(programme);
    assert.equal(programme.partner.partnerType, partnerType);
    assert.equal(programme.partner.reportingMode, "aggregate_only");
    assert.equal(programme.cohorts.length, 1);
    assert.equal(programme.campaigns.length, 1);
  }

  const first = programmes[0];
  let invite = await PartnerOnboardingService.validateInvite(first.cohorts[0].cohortKey);
  assert.equal(invite.invite.status, "ineligible");

  let transitioned = await PartnerProgrammeService.transitionProgramme(
    first.id,
    "active",
    actor.id
  );
  assert.equal(transitioned.status, "active");
  invite = await PartnerOnboardingService.validateInvite(first.cohorts[0].cohortKey);
  assert.equal(invite.invite.status, "valid");

  transitioned = await PartnerProgrammeService.transitionProgramme(
    first.id,
    "paused",
    actor.id
  );
  assert.equal(transitioned.status, "paused");
  invite = await PartnerOnboardingService.validateInvite(first.cohorts[0].cohortKey);
  assert.equal(invite.invite.status, "ineligible");

  const individualInviteProgramme = programmes[1];
  await PartnerProgrammeService.transitionProgramme(
    individualInviteProgramme.id,
    "active",
    actor.id
  );
  invite = await PartnerOnboardingService.validateInvite(
    individualInviteProgramme.cohorts[0].cohortKey
  );
  assert.equal(invite.invite.status, "ineligible");
  assert.match(invite.invite.message, /invite route is not enabled/);

  const response = JSON.stringify(await PartnerProgrammeService.getProgramme(first.id));
  for (const prohibitedCollection of [
    "members",
    "properties",
    "documents",
    "tasks",
    "consentRecords",
    "pilotEvents",
  ]) {
    assert.equal(response.includes(`\"${prohibitedCollection}\"`), false);
  }

  console.log(
    "Partner programme MySQL smoke passed for insurer, mortgage provider, home developer and other"
  );
})()
  .finally(async () => {
    if (partnerIds.length) await Partner.destroy({ where: { id: partnerIds } });
    if (actor) await actor.destroy();
    await sequelize.close();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
