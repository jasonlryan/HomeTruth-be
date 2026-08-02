#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const env = require('../config/env');

let sequelize;
let Document;
let TextSplitter;
let OpenAIEmbeddingService;
let qdrantClient;
let COLLECTION_NAME;
let initializeQdrant;
let VectorStore;

const DEFAULT_DOCS_DIR = path.resolve(__dirname, '../../hometruth DOCS');
const docsDir = path.resolve(process.argv[2] || DEFAULT_DOCS_DIR);
const BATCH_SIZE = Number(process.env.KB_EMBED_BATCH_SIZE || 64);

function assertEmbeddingKey() {
  const key = env.ai?.OpenAIKey;
  if (!key || key === 'replace-me') {
    throw new Error('OPENAI_API_KEY must be set to a valid key before loading knowledge-base vectors.');
  }
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === '.git') continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile() && ['.md', '.txt'].includes(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeText(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function extractContent(raw, relativePath) {
  const trimmed = raw.trim();

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.text === 'string') {
        return {
          title: parsed.title || path.basename(relativePath, path.extname(relativePath)),
          text: parsed.text,
          source: parsed.uri || 'HomeTruth Docs',
        };
      }
    } catch (_error) {
      // Fall through to raw markdown/text.
    }
  }

  return {
    title: path.basename(relativePath, path.extname(relativePath)),
    text: raw,
    source: 'HomeTruth Docs',
  };
}

function categoryFor(relativePath) {
  const parts = relativePath.split(path.sep);
  if (parts[0] === 'docs' && parts[1]) return parts[1];
  if (parts[0] === 'investor') return 'investor';
  return 'core';
}

async function upsertChunks(chunks, metadata) {
  let stored = 0;

  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    const embeddings = await OpenAIEmbeddingService.generateEmbeddings(batch.map((chunk) => chunk.text));
    const points = batch.map((chunk, index) => ({
      id: chunk.id,
      vector: embeddings[index],
      payload: {
        text: chunk.text,
        ...metadata,
        chunk_index: start + index,
        chunk_length: chunk.text.length,
      },
    }));

    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points,
    });

    stored += points.length;
  }

  return stored;
}

async function removeExisting(documentId) {
  const existing = await Document.findAll({ where: { documentId } });

  for (const doc of existing) {
    if (doc.sessionId) {
      await VectorStore.deleteByDocument(doc.sessionId).catch(() => {});
    }
    await doc.destroy();
  }
}

async function main() {
  if (!fs.existsSync(docsDir)) {
    throw new Error(`Docs directory not found: ${docsDir}`);
  }

  assertEmbeddingKey();

  sequelize = require('../config/database');
  Document = require('../models/documents');
  TextSplitter = require('../utils/textSplitter');
  OpenAIEmbeddingService = require('../services/openaiEmbeddingService');
  ({ qdrantClient, COLLECTION_NAME, initializeQdrant } = require('../config/qdrant'));
  VectorStore = require('../services/vectorStore');

  await sequelize.authenticate();
  await initializeQdrant();

  const files = walkFiles(docsDir).sort();
  console.log(`Loading ${files.length} knowledge files from ${docsDir}`);

  const summary = {
    files: 0,
    skipped: 0,
    chunks: 0,
  };

  for (const filePath of files) {
    const relativePath = path.relative(docsDir, filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    const extracted = extractContent(raw, relativePath);
    const textContent = normalizeText(extracted.text);

    if (!textContent) {
      summary.skipped += 1;
      continue;
    }

    const documentId = `docs:${relativePath.replaceAll(path.sep, '/')}`;
    await removeExisting(documentId);

    const chunks = TextSplitter.splitBySentences(textContent, 500);
    const sessionId = uuidv4();
    const now = new Date();
    const title = extracted.title.substring(0, 500);

    const document = await Document.create({
      sessionId,
      filename: path.basename(filePath),
      originalName: relativePath,
      fileType: path.extname(filePath).toLowerCase() || '.txt',
      fileSize: Buffer.byteLength(textContent, 'utf8'),
      textContent,
      chunksCount: 0,
      processedAt: now,
      title,
      category: categoryFor(relativePath),
      documentId,
      priority: 'Normal',
      source: extracted.source || 'HomeTruth Docs',
      tags: ['hometruth-docs', categoryFor(relativePath)],
      url: null,
      entryMethod: 'manual_entry',
    });

    const storedChunks = await upsertChunks(chunks, {
      document_id: sessionId,
      filename: title,
      upload_date: now.toISOString(),
      file_type: path.extname(filePath).toLowerCase() || '.txt',
      title,
      category: categoryFor(relativePath),
      priority: 'Normal',
      source: extracted.source || 'HomeTruth Docs',
      tags: ['hometruth-docs', categoryFor(relativePath)],
      entry_method: 'manual_entry',
      source_path: relativePath.replaceAll(path.sep, '/'),
      knowledge_document_id: documentId,
    });

    await document.update({ chunksCount: storedChunks });

    summary.files += 1;
    summary.chunks += storedChunks;
    console.log(`Indexed ${relativePath} (${storedChunks} chunks)`);
  }

  const info = await qdrantClient.getCollection(COLLECTION_NAME);
  console.log(JSON.stringify({
    imported_files: summary.files,
    skipped_files: summary.skipped,
    imported_chunks: summary.chunks,
    qdrant_collection: COLLECTION_NAME,
    qdrant_points: info.points_count || 0,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (sequelize) {
      await sequelize.close().catch(() => {});
    }
  });
