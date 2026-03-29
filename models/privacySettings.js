// ===== PRIVACY SETTINGS MODEL =====
// models/privacySettings.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PrivacySettings = sequelize.define('privacy_settings', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    
    // AI Personalization Preferences
    enableBehaviorBasedPersonalization: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Control how behavior and quiz responses are used to tailor suggestions and tone'
    },
    
    useChatHistoryToRefineInsights: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Use chat history to improve and refine AI insights'
    },
    
    optOutOfAttitudinalProfiling: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Opt out of attitudinal profiling based on user behavior'
    },
    
    // Consent & Analytics
    gdprDataCollectionConsent: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'GDPR compliant data collection consent'
    },
    
    allowAnonymousUsageAnalytics: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Allow collection of anonymous usage analytics to improve platform'
    },
    
    // Uploaded Document Settings (PRO feature)
    disableDocumentRetention: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Control how long files are stored after insights are generated'
    },
    
    // Data retention period in days (for document retention)
    documentRetentionPeriod: {
        type: DataTypes.INTEGER,
        defaultValue: 90,
        comment: 'Number of days to retain documents (0 = immediate deletion after processing)'
    },
    
    // Timestamps for consent tracking
    gdprConsentDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when GDPR consent was given'
    },
    
    analyticsConsentDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when analytics consent was given'
    }
    
}, {
    tableName: 'privacy_settings',
    timestamps: true,
    // createdAt: 'created_at',
    // updatedAt: 'updated_at',
    hooks: {
        beforeUpdate: (instance) => {
            // Track consent dates when settings are changed
            if (instance.changed('gdprDataCollectionConsent') && instance.gdprDataCollectionConsent) {
                instance.gdprConsentDate = new Date();
            }
            if (instance.changed('allowAnonymousUsageAnalytics') && instance.allowAnonymousUsageAnalytics) {
                instance.analyticsConsentDate = new Date();
            }
        },
        beforeCreate: (instance) => {
            // Set consent dates on creation
            if (instance.gdprDataCollectionConsent) {
                instance.gdprConsentDate = new Date();
            }
            if (instance.allowAnonymousUsageAnalytics) {
                instance.analyticsConsentDate = new Date();
            }
        }
    }
});

module.exports = PrivacySettings;
