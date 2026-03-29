const { QdrantClient } = require('@qdrant/js-client-rest');
const env = require('./env');

const qdrantClient = new QdrantClient({
  url: env.qdrant?.url || 'http://localhost:6333',
  apiKey: env.qdrant?.apiKey || null
});

const COLLECTION_NAME = env.qdrant?.collectionName || 'home_truth_documents';
const VECTOR_SIZE = env.qdrant?.vectorSize || 1536; // OpenAI text-embedding-3-small produces 1536-dimensional vectors

async function initializeQdrant() {
  try {
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(
      col => col.name === COLLECTION_NAME
    );

    if (!collectionExists) {
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine"
        }
      });
      console.log(`✅ Qdrant collection '${COLLECTION_NAME}' created successfully with ${VECTOR_SIZE} dimensions`);
    } else {
      // Check if collection has correct vector size
      const collectionInfo = await qdrantClient.getCollection(COLLECTION_NAME);
      // Handle different possible API response structures
      const currentVectorSize = collectionInfo.config?.params?.vectors?.size || 
                                collectionInfo.config?.params?.vectors?.default?.size ||
                                (typeof collectionInfo.config?.params?.vectors === 'object' && 
                                 !collectionInfo.config.params.vectors.size && 
                                 !collectionInfo.config.params.vectors.default ? 
                                 Object.values(collectionInfo.config.params.vectors)[0]?.size : null);
      
      if (currentVectorSize && currentVectorSize !== VECTOR_SIZE) {
        console.warn(`⚠️  Collection '${COLLECTION_NAME}' exists with ${currentVectorSize} dimensions, but OpenAI requires ${VECTOR_SIZE}`);
        console.warn(`⚠️  You need to recreate the collection. Existing data will be lost.`);
        console.warn(`⚠️  To fix: Run 'node scripts/recreateQdrantCollections.js' or manually delete the collection via Qdrant API.`);
        throw new Error(`Collection dimension mismatch: expected ${VECTOR_SIZE}, got ${currentVectorSize}. Please recreate the collection.`);
      }
      
      if (currentVectorSize) {
        console.log(`✅ Qdrant collection '${COLLECTION_NAME}' already exists with correct dimensions (${VECTOR_SIZE})`);
      } else {
        console.log(`✅ Qdrant collection '${COLLECTION_NAME}' already exists`);
      }
    }
  } catch (error) {
    console.error('❌ Qdrant initialization error:', error);
    throw error;
  }
}

async function checkQdrantConnection() {
  try {
    await qdrantClient.getCollections();
    console.log('✅ Qdrant connection successful');
    return true;
  } catch (error) {
    console.error('❌ Qdrant connection failed:', error);
    return false;
  }
}

async function initializeUserDocumentsCollection() {
  try {
    const collections = await qdrantClient.getCollections();
    const userDocsCollection = env.qdrant?.userDocumentsCollection || 'user_documents';
    const collectionExists = collections.collections.some(
      col => col.name === userDocsCollection
    );

    if (!collectionExists) {
      await qdrantClient.createCollection(userDocsCollection, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine"
        }
      });
      console.log(`✅ Qdrant user documents collection '${userDocsCollection}' created successfully with ${VECTOR_SIZE} dimensions`);
    } else {
      // Check if collection has correct vector size
      const collectionInfo = await qdrantClient.getCollection(userDocsCollection);
      // Handle different possible API response structures
      const currentVectorSize = collectionInfo.config?.params?.vectors?.size || 
                                collectionInfo.config?.params?.vectors?.default?.size ||
                                (typeof collectionInfo.config?.params?.vectors === 'object' && 
                                 !collectionInfo.config.params.vectors.size && 
                                 !collectionInfo.config.params.vectors.default ? 
                                 Object.values(collectionInfo.config.params.vectors)[0]?.size : null);
      
      if (currentVectorSize && currentVectorSize !== VECTOR_SIZE) {
        console.warn(`⚠️  User documents collection exists with ${currentVectorSize} dimensions, but OpenAI requires ${VECTOR_SIZE}`);
        console.warn(`⚠️  You need to recreate the collection. Existing data will be lost.`);
        console.warn(`⚠️  To fix: Run 'node scripts/recreateQdrantCollections.js' or manually delete the collection via Qdrant API.`);
        throw new Error(`User documents collection dimension mismatch: expected ${VECTOR_SIZE}, got ${currentVectorSize}. Please recreate the collection.`);
      }
      
      if (currentVectorSize) {
        console.log(`✅ Qdrant user documents collection '${userDocsCollection}' already exists with correct dimensions (${VECTOR_SIZE})`);
      } else {
        console.log(`✅ Qdrant user documents collection '${userDocsCollection}' already exists`);
      }
    }
  } catch (error) {
    console.error('❌ User documents collection initialization error:', error);
    throw error;
  }
}

/**
 * Delete and recreate collection with correct dimensions
 * WARNING: This will delete all existing data in the collection
 */
async function recreateCollection(collectionName = COLLECTION_NAME) {
  try {
    console.log(`🗑️  Deleting collection '${collectionName}'...`);
    await qdrantClient.deleteCollection(collectionName);
    console.log(`✅ Collection '${collectionName}' deleted`);
    
    console.log(`🔄 Creating collection '${collectionName}' with ${VECTOR_SIZE} dimensions...`);
    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine"
      }
    });
    console.log(`✅ Collection '${collectionName}' recreated successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error recreating collection '${collectionName}':`, error);
    throw error;
  }
}

module.exports = {
  qdrantClient,
  COLLECTION_NAME,
  VECTOR_SIZE,
  initializeQdrant,
  initializeUserDocumentsCollection,
  checkQdrantConnection,
  recreateCollection
};
