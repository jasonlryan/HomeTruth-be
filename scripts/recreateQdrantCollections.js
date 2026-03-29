#!/usr/bin/env node

/**
 * Utility script to recreate Qdrant collections with correct dimensions for OpenAI embeddings
 * WARNING: This will delete all existing data in the collections
 */

const { recreateCollection, COLLECTION_NAME, qdrantClient } = require('../config/qdrant');
const env = require('../config/env');

async function main() {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║      Recreating Qdrant Collections for OpenAI Embeddings      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    
    // Check connection first
    try {
      await qdrantClient.getCollections();
      console.log('✅ Connected to Qdrant\n');
    } catch (error) {
      console.error('❌ Failed to connect to Qdrant:', error.message);
      process.exit(1);
    }

    // Recreate main collection
    console.log(`📦 Recreating main collection: ${COLLECTION_NAME}`);
    await recreateCollection(COLLECTION_NAME);
    console.log('');

    // Recreate user documents collection
    const userDocsCollection = env.qdrant?.userDocumentsCollection || 'user_documents';
    console.log(`📦 Recreating user documents collection: ${userDocsCollection}`);
    await recreateCollection(userDocsCollection);
    console.log('');

    console.log('✅ All collections recreated successfully!');
    console.log('⚠️  Note: You may need to re-upload your documents to populate the collections.\n');
    
  } catch (error) {
    console.error('\n❌ Error recreating collections:', error.message);
    process.exit(1);
  }
}

main();

