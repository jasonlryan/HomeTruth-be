const { test } = require('node:test');
const assert = require('node:assert/strict');

// Inject the shared collection client before loading the service.
const config = require.resolve('../config/qdrant');
const embeddings = require.resolve('../services/openaiEmbeddingService');
const calls = [];
require.cache[config] = { exports: {
  COLLECTION_NAME: 'shared-index',
  qdrantClient: { scroll: async (...args) => {
    calls.push(args);
    return { points: [{ id: 12, payload: { filename: 'Roof manual', chunk_index: 0 } }], next_page_offset: 15 };
  } }
} };
require.cache[embeddings] = { exports: {} };
const VectorStore = require('../services/vectorStore');

test('inventory scrolls the shared collection and returns point metadata and cursor', async () => {
  const page = await VectorStore.listIndexedRecords(12);
  assert.deepEqual(page, {
    records: [{ id: 12, title: 'Roof manual', documentId: null, chunkIndex: 0 }],
    nextCursor: 15
  });
  assert.deepEqual(calls, [['shared-index', {
    limit: 25, offset: 12, with_vector: false,
    with_payload: ['title', 'filename', 'document_id', 'chunk_index']
  }]]);
});
