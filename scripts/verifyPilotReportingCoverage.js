const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const modelsPath = require.resolve("../models");
const servicePath = require.resolve("../services/pilotAnalyticsService");
const countByEvent = {
  signup_completed: 3,
  consent_recorded: 3,
  property_setup_completed: 2,
  document_linked: 2,
  tasks_generated: 2,
  property_chat_question: 1,
};

const originalModels = require.cache[modelsPath];
require.cache[modelsPath] = {
  id: modelsPath,
  filename: modelsPath,
  loaded: true,
  exports: {
    PartnerCohort: {
      findAll: async () => [
        {
          id: 7,
          name: "Representative cohort",
          cohort_key: "representative-2026",
          status: "active",
          target_size: 500,
          start_date: null,
          end_date: null,
          Partner: {
            id: 4,
            name: "Representative partner",
            partner_type: "insurer",
            reporting_mode: "aggregate_only",
          },
        },
      ],
    },
    CohortMember: {
      count: async ({ where }) => {
        if (where.property_id) return 2;
        if (where.membership_status) {
          return where.membership_status[Symbol.for("placeholder")] ? 0 : 3;
        }
        return 5;
      },
    },
    ConsentRecord: { count: async () => 3 },
    Partner: {},
    PilotEvent: {
      findAll: async ({ where, group }) => {
        if (group) {
          return [
            { event_name: "invite_viewed", count: "5" },
            { event_name: "signup_completed", count: "3" },
            { event_name: "consent_recorded", count: "3" },
            { event_name: "property_setup_completed", count: "2" },
            { event_name: "document_linked", count: "4" },
            { event_name: "tasks_generated", count: "3" },
            { event_name: "task_completed", count: "2" },
            { event_name: "task_dismissed", count: "1" },
            { event_name: "property_chat_question", count: "1" },
            { event_name: "user_feedback_submitted", count: "2" },
          ];
        }
        if (where.event_name === "user_feedback_submitted") {
          return [{ metadata: { rating: 4 } }, { metadata: { rating: 5 } }];
        }
        return [];
      },
      count: async ({ where, distinct }) => {
        if (!distinct) return 23;
        if (typeof where.event_name === "string") return countByEvent[where.event_name] || 0;
        return 2;
      },
    },
  },
};
delete require.cache[servicePath];

const PilotAnalyticsService = require("../services/pilotAnalyticsService");

(async () => {
  const report = await PilotAnalyticsService.getCohortReport({ period: "all" });
  const { metrics, metricCoverage } = report.reports[0];

  assert.equal(metrics.activationRate, 60);
  assert.equal(metrics.propertySetupCompletionRate, 67);
  assert.equal(metrics.consentRate, 100);
  assert.equal(metrics.documentLinksPerActivatedMember, 1.3);
  assert.equal(metrics.taskActionedMembers, 2);
  assert.equal(metrics.propertyChatQuestionedMembers, 1);
  assert.equal(metrics.propertyChatUsageRate, 33);
  assert.equal(metrics.repeatActiveMembers, null);
  assert.equal(metricCoverage.repeatUse, "not_instrumented");
  assert.equal(metricCoverage.propertyAwareChatUsage, "measured");
  assert.deepEqual(report.reports[0].dropOff, {
    inviteToSignup: 2,
    signupToConsent: 0,
    consentToProperty: 1,
    propertyToDocument: 0,
  });

  const serialized = JSON.stringify(report);
  for (const prohibitedField of [
    "userId",
    "cohortMemberId",
    "propertyId",
    "documentName",
    "rawFactValue",
    "feedbackText",
  ]) {
    assert.equal(serialized.includes(prohibitedField), false);
  }

  const chatController = fs.readFileSync(
    path.join(root, "Controllers/AI/ai_chat.js"),
    "utf8"
  );
  assert.match(chatController, /eventName: "property_chat_question"/);
  assert.equal(chatController.includes("metadata: {\n            userMessage"), false);

  console.log("Pilot reporting coverage checks passed");
})()
  .finally(() => {
    delete require.cache[servicePath];
    if (originalModels) require.cache[modelsPath] = originalModels;
    else delete require.cache[modelsPath];
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
