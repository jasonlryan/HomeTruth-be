const { default: OpenAI } = require('openai');
const path = require('path');

const envFile = process.env.APP_ENV === 'staging' ? '.env_staging' : '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

const requiredEnvVars = [
  "PORT",
  "DB_PORT",
  "DB_HOST",
  "DB_NAME",
  "DB_USER",
  "JWT_SECRET",
  "SENDGRID_API_KEY",
  "OPENAI_API_KEY",
  "FRONTEND_URL",
  "APP_NAME",
  "SERVER_BASE_URL",

  "AGENCY_REF",
  "CLIENT_ID",
  "CLIENT_SECRET",


  "NODE_ENV"
];

// Check if all required environment variables exist
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// Exporting variables
module.exports = {
  port: process.env.PORT,
  db: {
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME
  },
  gmail:{
    gmailUser: process.env.GMAIL_USER,
    gmailPass: process.env.GMAIL_APP_PASSWORD,
    
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || process.env.GMAIL_USER,
  },
  zoopla:{
    clientSecret: process.env.CLIENT_SECRET,
    clientId: process.env.CLIENT_ID,
    agencyRef: process.env.AGENCY_REF,
    
  },
  ai:{ OpenAIKey: process.env.OPENAI_API_KEY},
  jwtSecret: process.env.JWT_SECRET,
  nodeEnv: process.env.NODE_ENV,
  frontEndUrl:process.env.FRONTEND_URL,
  appName:process.env.APP_NAME,
  serverBaseUrl:process.env.SERVER_BASE_URL,
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY || null,
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'home_truth_documents',
    userDocumentsCollection: process.env.QDRANT_USER_DOCUMENTS_COLLECTION || 'user_documents',
    vectorSize: parseInt(process.env.QDRANT_VECTOR_SIZE) || 1536 // OpenAI embeddings
  },
  openaiLlm: {
    model: process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini'
  },
  webSearch: {
    serpApiKey: process.env.SERPAPI_KEY || '7b034b9e24091d1b91fc6d7eb9cbcc6712aeea34e414978edbac148f6847f2d9',
    bingApiKey: process.env.BING_SEARCH_API_KEY || null // Deprecated: Bing Search API retires Aug 2025
  },
  ssl: {
    enabled: process.env.SSL === "true",
    keyPath: process.env.SSL_KEY_PATH,
    certPath: process.env.SSL_CERT_PATH,
  },

};
