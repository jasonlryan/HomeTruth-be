const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const NotificationSettings = sequelize.define('notification_Settings', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
    allowNull: false,
    },
    
    // Checklist & Task Updates
    documentAnalysisComplete: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Be notified when your property documents have been scanned by AI'
    },
    
    // AI Chat Follow-ups
    chatSummaryFollowUps: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Get summaries and suggested actions after asking questions in chat'
    },
    
    newAiInsightsAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Be alerted when new document-based insights are added to your dashboard'
    },
    
    // Listings & Discovery Alerts
    propertyAlerts: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Be notified when a listing matches your lifestyle and saved tags'
    },
    
    extensionSaveConfirmations: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Show a toast when saving a listing from a partner site'
    },
    
    // Product Tips & Feature Updates
    tipsAndProductUpdates: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Occasional guidance on how to use features and platform enhancements'
    }
  },);


module.exports = NotificationSettings;