const sgMail = require('@sendgrid/mail');
const env = require('./../config/env');

// Initialize SendGrid
const initializeSendGrid = () => {
  // Validate required environment variables
  if (!env.sendgrid.apiKey) {
    throw new Error('SendGrid API key not found in environment variables');
  }

  sgMail.setApiKey(env.sendgrid.apiKey);
  return sgMail;
};

// Create SendGrid mailer instance
const createSendGridTransporter = () => {
  return initializeSendGrid();
};

// Test SendGrid connection
const testEmailConnection = async () => {
  try {
    initializeSendGrid();
    // SendGrid doesn't have a verify method like nodemailer,
    // but we can check if the API key is set
    if (!env.sendgrid.apiKey) {
      throw new Error('SendGrid API key not configured');
    }
    console.log('✅ SendGrid email service initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ SendGrid email service initialization failed:', error.message);
    return false;
  }
};

module.exports = {
  createSendGridTransporter,
  testEmailConnection
};
