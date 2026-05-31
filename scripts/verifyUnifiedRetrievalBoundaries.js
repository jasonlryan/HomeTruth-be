"use strict";

const assert = require("assert");

const requiredEnvDefaults = {
  PORT: "4000",
  DB_PORT: "3306",
  DB_HOST: "localhost",
  DB_NAME: "hometruth_test",
  DB_USER: "root",
  JWT_SECRET: "test-secret",
  SENDGRID_API_KEY: "test-sendgrid",
  OPENAI_API_KEY: "test-openai",
  FRONTEND_URL: "http://localhost:3000",
  APP_NAME: "HomeTruth",
  SERVER_BASE_URL: "http://localhost:4000",
  AGENCY_REF: "test-agency",
  CLIENT_ID: "test-client",
  CLIENT_SECRET: "test-secret",
  NODE_ENV: "test",
  AUTO_SYNC_DB: "false",
};

Object.entries(requiredEnvDefaults).forEach(([key, value]) => {
  if (!process.env[key]) process.env[key] = value;
});

const UserDocumentVectorService = require("../services/userDocumentVectorService");
const { qdrantClient } = require("../config/qdrant");

const findCondition = (filter, key) =>
  filter.must.find((condition) => condition.key === key);

const assertUserScopedFilter = (filter, userId) => {
  const userCondition = findCondition(filter, "user_id");
  assert(userCondition, "Qdrant filter must include user_id");
  assert.deepStrictEqual(userCondition.match, { value: userId });
};

async function run() {
  const baseFilter = UserDocumentVectorService.buildUserDocumentFilter(101);
  assertUserScopedFilter(baseFilter, 101);

  const documentFilter = UserDocumentVectorService.buildUserDocumentFilter(101, {
    documentIds: [201, "202", 202, null, "bad"],
  });
  assertUserScopedFilter(documentFilter, 101);
  assert.deepStrictEqual(findCondition(documentFilter, "document_id").match, {
    any: [201, 202],
  });

  const originalSearch = qdrantClient.search;
  const calls = [];

  try {
    qdrantClient.search = async (collectionName, options) => {
      calls.push({ collectionName, options });
      return [
        {
          id: "vector-1",
          score: 0.92,
          payload: {
            text: "Only the authenticated user's matching vector is eligible.",
            document_id: 201,
            user_id: 101,
            filename: "survey.pdf",
            doc_type: "Property Survey Report",
            category: "surveys_reports",
            tags: ["survey"],
            chunk_index: 0,
          },
        },
      ];
    };

    const results = await UserDocumentVectorService.searchUserDocumentsByEmbedding(
      [0.1, 0.2, 0.3],
      101,
      { documentIds: [201, 202] },
      5
    );

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].collectionName, "user_documents");
    assertUserScopedFilter(calls[0].options.filter, 101);
    assert.deepStrictEqual(findCondition(calls[0].options.filter, "document_id").match, {
      any: [201, 202],
    });
    assert.strictEqual(results[0].metadata.user_id, 101);

    calls.length = 0;
    const emptyPropertyScopeResults =
      await UserDocumentVectorService.searchUserDocumentsByEmbedding(
        [0.1, 0.2, 0.3],
        101,
        { documentIds: [] },
        5
      );

    assert.deepStrictEqual(emptyPropertyScopeResults, []);
    assert.strictEqual(
      calls.length,
      0,
      "Empty property document scope must not fall back to all user vectors"
    );
  } finally {
    qdrantClient.search = originalSearch;
  }

  console.log("Unified retrieval boundary checks passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
