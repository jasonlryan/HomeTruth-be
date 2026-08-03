const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  CohortMember,
  ConsentRecord,
  Partner,
  PartnerCohort,
  PilotEvent,
  Property,
  PropertyPerson,
  User,
} = require("../models");
const PartnerOnboardingService = require("../services/partnerOnboardingService");
const PartnerProgrammeService = require("../services/partnerProgrammeService");

const token = randomUUID().replaceAll("-", "").slice(0, 12);
const partnerTypes = [
  "insurer",
  "mortgage_provider",
  "home_developer",
  "other",
];
const partnerIds = [];
const userIds = [];
const propertyIds = [];
let actor = null;

const payloadFor = (partnerType, index) => ({
  partner: {
    name: `HT-330 ${partnerType} ${token}`,
    partnerType,
    externalRef: `ht330-${token}-${index}`,
  },
  programmeKey: `ht330-${token}-programme-${index}`,
  name: `HT-330 ${partnerType} programme`,
  startDate: "2026-08-01",
  endDate: "2027-08-31",
  entitlement: { pack: "shared_core", participantLimit: 8 },
  inviteMode: "both",
  approvedContentRefs: [`copy/ht330-${partnerType}-v1`],
  campaign: {
    campaignKey: `ht330-${token}-campaign-${index}`,
    name: `HT-330 ${partnerType} campaign`,
    inviteRoute: `/partner/ht330-${token}-cohort-${index}`,
    approvedContentRef: `copy/ht330-${partnerType}-v1`,
    acquisitionConfig: {
      eyebrow: "A HomeTruth partner programme",
      headline: `Approved ${partnerType} homeowner journey`,
      homeownerPromise: "A shared-core homeowner promise.",
      setupExpectations: ["Choose permissions", "Connect a home"],
      privacySummary:
        "The partner receives no individual property, document or task data.",
      support: { label: "HomeTruth support", url: "/faq" },
    },
    consentConfig: { version: `ht330-${partnerType}-v1` },
    startDate: "2026-08-01",
    endDate: "2027-08-31",
  },
  cohort: {
    cohortKey: `ht330-${token}-cohort-${index}`,
    name: `HT-330 ${partnerType} cohort`,
    targetSize: 8,
    startDate: "2026-08-01",
    endDate: "2027-08-31",
  },
});

const createUser = async (partnerType, index) => {
  const user = await User.create({
    first_name: "HT-330",
    last_name: partnerType,
    email: `ht330-${token}-${index}@hometruth.local`,
    password: randomUUID(),
    role: "user",
    is_verified: true,
  });
  userIds.push(user.id);
  return user;
};

(async () => {
  await sequelize.authenticate();
  actor = await User.create({
    first_name: "HT-330",
    last_name: "Admin",
    email: `ht330-${token}-admin@hometruth.local`,
    password: randomUUID(),
    role: "admin",
    is_verified: true,
  });
  userIds.push(actor.id);

  const fixtures = [];
  for (const [index, partnerType] of partnerTypes.entries()) {
    const programme = await PartnerProgrammeService.createProgramme(
      payloadFor(partnerType, index + 1),
      actor.id
    );
    partnerIds.push(programme.partner.id);
    await PartnerProgrammeService.transitionProgramme(
      programme.id,
      "active",
      actor.id
    );

    const user = await createUser(partnerType, index + 1);
    let inviteCode = programme.cohorts[0].cohortKey;
    if (partnerType === "mortgage_provider") {
      const member = await CohortMember.create({
        partner_cohort_id: programme.cohorts[0].id,
        external_member_ref: `ht330-${token}-personal-${index + 1}`,
        membership_status: "invited",
        source_type: "manual",
      });
      inviteCode = member.external_member_ref;
    }

    const publicInvite = await PartnerOnboardingService.validateInvite(inviteCode);
    assert.equal(publicInvite.invite.status, "valid");
    assert.equal(publicInvite.partner.partnerType, partnerType);
    assert.equal(publicInvite.programme.id, programme.id);
    assert.equal(publicInvite.campaign.id, programme.campaigns[0].id);
    assert.equal(publicInvite.acquisition.partnerType, partnerType);
    assert.equal(
      publicInvite.acquisition.headline,
      `Approved ${partnerType} homeowner journey`
    );
    assert.equal(publicInvite.consentContract.version, `ht330-${partnerType}-v1`);
    assert.deepEqual(
      publicInvite.consentContract.scopes.map(({ scope }) => scope),
      [
        "hometruth_processing",
        "aggregate_analytics",
        "partner_reporting",
        "partner_contact_servicing",
      ]
    );
    if (publicInvite.member) {
      assert.deepEqual(Object.keys(publicInvite.member), ["membershipStatus"]);
    }
    const publicJson = JSON.stringify(publicInvite);
    for (const prohibited of ["userId", "propertyId", "externalMemberRef"])
      assert.equal(publicJson.includes(prohibited), false);

    const viewed = await PartnerOnboardingService.recordInviteViewed(inviteCode);
    assert.equal(viewed.partnerProgrammeId, programme.id);
    assert.equal(viewed.partnerCampaignId, programme.campaigns[0].id);
    assert.equal(viewed.userId, null);
    assert.equal(viewed.cohortMemberId, null);

    await assert.rejects(
      PartnerOnboardingService.recordConsents(user.id, inviteCode, {
        consents: [{ scope: "hometruth_processing", granted: false }],
      }),
      /hometruth_processing consent is required/
    );
    await assert.rejects(
      PartnerOnboardingService.emitEvent(user.id, {
        eventName: "property_started",
        inviteCode,
        metadata: { path: "new_property" },
      }),
      /processing consent is required/
    );

    let property = null;
    if (partnerType === "insurer") {
      property = await Property.create({
        property_type: "house",
        tenure: "freehold",
        lifecycle_status: "active",
        source_type: "manual",
        created_by_user_id: user.id,
      });
      propertyIds.push(property.id);
      await PropertyPerson.create({
        property_id: property.id,
        user_id: user.id,
        relationship_type: "owner",
        relationship_status: "active",
        permission_level: "admin",
        is_primary: true,
        verification_status: "user_confirmed",
        source_type: "manual",
      });
      await assert.rejects(
        PartnerOnboardingService.attachProperty(user.id, inviteCode, property.id),
        /processing consent is required/
      );
    }

    const aggregateGranted = partnerType === "insurer";
    const recorded = await PartnerOnboardingService.recordConsents(
      user.id,
      inviteCode,
      {
        consentVersion: "browser-forged-v99",
        consents: [
          {
            scope: "hometruth_processing",
            granted: true,
            version: "browser-forged-v99",
            textHash: "browser-forged-hash",
          },
          { scope: "aggregate_analytics", granted: aggregateGranted },
          { scope: "partner_reporting", granted: false },
          { scope: "partner_contact_servicing", granted: false },
        ],
      }
    );
    assert.equal(recorded.consentState.completed, true);
    assert.equal(recorded.consentState.choices.partner_reporting, false);
    assert.equal(recorded.consentState.choices.partner_contact_servicing, false);
    assert.equal(recorded.consents.length, 4);
    assert.equal(
      recorded.consents.some(({ consentScope }) => consentScope === "individual_report_access"),
      false
    );
    for (const consent of recorded.consents) {
      const definition = recorded.consentContract.scopes.find(
        ({ scope }) => scope === consent.consentScope
      );
      assert.equal(consent.consentVersion, `ht330-${partnerType}-v1`);
      const persisted = await ConsentRecord.findByPk(consent.id);
      assert.equal(persisted.consent_text_hash, definition.textHash);
      assert.notEqual(persisted.consent_text_hash, "browser-forged-hash");
    }

    const propertyStarted = await PartnerOnboardingService.emitEvent(user.id, {
      eventName: "property_started",
      inviteCode,
      metadata: {
        path: "existing_property",
        email: "must-not-be-stored@example.com",
        freeText: "must not be stored",
        policyNumber: "POLICY-123",
      },
    });
    assert.deepEqual(propertyStarted.metadata, { path: "existing_property" });
    assert.equal(propertyStarted.partnerContextAllowed, aggregateGranted);
    assert.equal(
      propertyStarted.partnerProgrammeId,
      aggregateGranted ? programme.id : null
    );
    assert.equal(
      propertyStarted.partnerCampaignId,
      aggregateGranted ? programme.campaigns[0].id : null
    );

    if (partnerType === "insurer") {
      const linked = await PartnerOnboardingService.attachProperty(
        user.id,
        inviteCode,
        property.id
      );
      assert.equal(linked.member.propertyId, property.id);
      await PartnerOnboardingService.recordConsents(user.id, inviteCode, {
        consents: [
          { scope: "hometruth_processing", granted: true },
          { scope: "aggregate_analytics", granted: true },
          { scope: "partner_reporting", granted: false },
          { scope: "partner_contact_servicing", granted: false },
        ],
      });
      assert.equal(
        await PilotEvent.count({
          where: { user_id: user.id, event_name: "signup_completed" },
        }),
        1
      );
    }

    fixtures.push({ partnerType, programme, inviteCode });
  }

  const invalid = await PartnerOnboardingService.validateInvite(
    `ht330-${token}-not-found`
  );
  assert.equal(invalid.invite.status, "invalid");
  assert.equal(invalid.partner, null);
  assert.equal(invalid.programme, null);
  assert.equal(invalid.campaign, null);
  assert.equal(invalid.member, null);

  await PartnerProgrammeService.transitionProgramme(
    fixtures[1].programme.id,
    "paused",
    actor.id
  );
  assert.equal(
    (await PartnerOnboardingService.validateInvite(fixtures[1].inviteCode)).invite
      .status,
    "ineligible"
  );

  await PartnerCohort.update(
    { end_date: "2026-08-02" },
    { where: { id: fixtures[2].programme.cohorts[0].id } }
  );
  assert.equal(
    (await PartnerOnboardingService.validateInvite(fixtures[2].inviteCode)).invite
      .status,
    "expired"
  );

  await PartnerProgrammeService.transitionProgramme(
    fixtures[3].programme.id,
    "closed",
    actor.id
  );
  assert.equal(
    (await PartnerOnboardingService.validateInvite(fixtures[3].inviteCode)).invite
      .status,
    "ineligible"
  );

  const attributed = await PilotEvent.findAll({
    where: {
      user_id: userIds,
      partner_programme_id: { [Op.ne]: null },
      partner_campaign_id: { [Op.ne]: null },
    },
  });
  assert.ok(attributed.length >= 3);

  console.log(
    "Partner acquisition MySQL smoke passed for programme resolution, consent integrity, privacy and attribution across all four partner types"
  );
})()
  .finally(async () => {
    if (userIds.length) {
      await PilotEvent.destroy({ where: { user_id: userIds } });
      await ConsentRecord.destroy({ where: { user_id: userIds } });
      await CohortMember.destroy({ where: { user_id: userIds } });
    }
    if (propertyIds.length) {
      await PropertyPerson.destroy({ where: { property_id: propertyIds } });
      await Property.destroy({ where: { id: propertyIds } });
    }
    if (partnerIds.length) {
      await PilotEvent.destroy({ where: { partner_id: partnerIds } });
      await Partner.destroy({ where: { id: partnerIds } });
    }
    if (userIds.length) await User.destroy({ where: { id: userIds } });
    await sequelize.close();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
