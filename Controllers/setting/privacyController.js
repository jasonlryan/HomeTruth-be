const PrivacySettings = require('../../models/privacySettings');
const User = require('../../models/User');

class PrivacySettingsController {
    
    // Get privacy settings for a user
    static async getSettings(req, res) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user_id = req.user.id;
            
            let settings = await PrivacySettings.findOne({
                where: { user_id },
                include: [{
                    model: User,
                    attributes: ['id', 'first_name', 'last_name', 'email', 'role']
                }]
            });

            // If no settings exist, create default settings
            if (!settings) {
                settings = await PrivacySettings.create({
                    user_id,
                    enableBehaviorBasedPersonalization: true,
                    useChatHistoryToRefineInsights: true,
                    optOutOfAttitudinalProfiling: false,
                    gdprDataCollectionConsent: true,
                    allowAnonymousUsageAnalytics: true,
                    disableDocumentRetention: false,
                    documentRetentionPeriod: 90
                });
            }

            res.status(200).json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Error fetching privacy settings:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching privacy settings',
                error: error.message
            });
        }
    }

    // Update privacy settings for a user
    static async updateSettings(req, res) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user_id = req.user.id;
            const updateData = req.body;

            // Validate update data
            const validSettings = [
                'enableBehaviorBasedPersonalization',
                'useChatHistoryToRefineInsights',
                'optOutOfAttitudinalProfiling',
                'gdprDataCollectionConsent',
                'allowAnonymousUsageAnalytics',
                'disableDocumentRetention',
                'documentRetentionPeriod'
            ];

            const filteredUpdateData = {};
            for (const [key, value] of Object.entries(updateData)) {
                if (validSettings.includes(key)) {
                    if (key === 'documentRetentionPeriod') {
                        if (typeof value === 'number' && value >= 0 && value <= 3650) {
                            filteredUpdateData[key] = value;
                        } else {
                            return res.status(400).json({
                                success: false,
                                message: 'documentRetentionPeriod must be a number between 0 and 3650 days'
                            });
                        }
                    } else {
                        if (typeof value === 'boolean') {
                            filteredUpdateData[key] = value;
                        } else {
                            return res.status(400).json({
                                success: false,
                                message: `Invalid value for ${key}. Must be boolean.`
                            });
                        }
                    }
                }
            }

            if (Object.keys(filteredUpdateData).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No valid settings provided for update'
                });
            }

            // Try to update existing settings
            const [updatedRowsCount] = await PrivacySettings.update(
                filteredUpdateData,
                { where: { user_id } }
            );

            if (updatedRowsCount === 0) {
                // Create new settings if none exist
                const newSettings = await PrivacySettings.create({
                    user_id,
                    enableBehaviorBasedPersonalization: true,
                    useChatHistoryToRefineInsights: true,
                    optOutOfAttitudinalProfiling: false,
                    gdprDataCollectionConsent: true,
                    allowAnonymousUsageAnalytics: true,
                    disableDocumentRetention: false,
                    documentRetentionPeriod: 90,
                    ...filteredUpdateData
                });
                
                return res.status(201).json({
                    success: true,
                    message: 'Privacy settings created',
                    data: newSettings
                });
            }

            // Fetch updated settings
            const updatedSettings = await PrivacySettings.findOne({
                where: { user_id }
            });

            res.status(200).json({
                success: true,
                message: 'Privacy settings updated successfully',
                data: updatedSettings
            });
        } catch (error) {
            console.error('Error updating privacy settings:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating privacy settings',
                error: error.message
            });
        }
    }

    // Update specific privacy setting
    static async updateSpecificSetting(req, res) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user_id = req.user.id;
            const { setting_name } = req.params;
            const { value } = req.body;

            const validSettings = [
                'enableBehaviorBasedPersonalization',
                'useChatHistoryToRefineInsights',
                'optOutOfAttitudinalProfiling',
                'gdprDataCollectionConsent',
                'allowAnonymousUsageAnalytics',
                'disableDocumentRetention',
                'documentRetentionPeriod'
            ];

            if (!validSettings.includes(setting_name)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid setting name',
                    validSettings
                });
            }

            // Validate value based on setting type
            if (setting_name === 'documentRetentionPeriod') {
                if (typeof value !== 'number' || value < 0 || value > 3650) {
                    return res.status(400).json({
                        success: false,
                        message: 'documentRetentionPeriod must be a number between 0 and 3650 days'
                    });
                }
            } else {
                if (typeof value !== 'boolean') {
                    return res.status(400).json({
                        success: false,
                        message: 'Setting value must be boolean'
                    });
                }
            }

            const [updatedRowsCount] = await PrivacySettings.update(
                { [setting_name]: value },
                { where: { user_id } }
            );

            if (updatedRowsCount === 0) {
                // Create default settings with the specific update
                const defaultSettings = {
                    user_id,
                    enableBehaviorBasedPersonalization: true,
                    useChatHistoryToRefineInsights: true,
                    optOutOfAttitudinalProfiling: false,
                    gdprDataCollectionConsent: true,
                    allowAnonymousUsageAnalytics: true,
                    disableDocumentRetention: false,
                    documentRetentionPeriod: 90,
                    [setting_name]: value
                };

                const newSettings = await PrivacySettings.create(defaultSettings);
                
                return res.status(201).json({
                    success: true,
                    message: 'Privacy settings created with updated setting',
                    data: newSettings
                });
            }

            const updatedSettings = await PrivacySettings.findOne({
                where: { user_id }
            });

            res.status(200).json({
                success: true,
                message: `${setting_name} updated successfully`,
                data: updatedSettings
            });
        } catch (error) {
            console.error('Error updating privacy setting:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating privacy setting',
                error: error.message
            });
        }
    }

    // Export user data (GDPR compliance)
    static async exportUserData(req, res) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user_id = req.user.id;

            // Get user data and privacy settings
            const user = await User.findByPk(user_id, {
                attributes: { exclude: ['password'] }
            });

            const privacySettings = await PrivacySettings.findOne({
                where: { user_id }
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const exportData = {
                user: user,
                privacySettings: privacySettings,
                exportDate: new Date().toISOString(),
                dataTypes: [
                    'Profile Information',
                    'Privacy Settings',
                    'Consent Records'
                ]
            };

            res.status(200).json({
                success: true,
                message: 'User data exported successfully',
                data: exportData
            });
        } catch (error) {
            console.error('Error exporting user data:', error);
            res.status(500).json({
                success: false,
                message: 'Error exporting user data',
                error: error.message
            });
        }
    }

    // Delete user data (GDPR right to be forgotten)
    static async deleteUserData(req, res) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }
    
            const user_id = req.user.id;
    
            // Delete privacy settings first (due to foreign key constraint)
            await PrivacySettings.destroy({
                where: { user_id }
            });
    
            // Delete user account
            const deletedUser = await User.destroy({
                where: { id: user_id }
            });
    
            if (deletedUser === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
    
            return res.status(200).json({
                success: true,
                message: 'User data deleted successfully. Account has been permanently removed.'
            });
        } catch (error) {
            console.error('Error deleting user data:', error);
            return res.status(500).json({
                success: false,
                message: 'Error deleting user data',
                error: error.message
            });
        }
    }
    

    // Reset privacy settings to default
    static async resetSettings(req, res) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user_id = req.user.id;

            const defaultSettings = {
                enableBehaviorBasedPersonalization: true,
                useChatHistoryToRefineInsights: true,
                optOutOfAttitudinalProfiling: false,
                gdprDataCollectionConsent: true,
                allowAnonymousUsageAnalytics: true,
                disableDocumentRetention: false,
                documentRetentionPeriod: 90
            };

            const [updatedRowsCount] = await PrivacySettings.update(
                defaultSettings,
                { where: { user_id } }
            );

            if (updatedRowsCount === 0) {
                const newSettings = await PrivacySettings.create({
                    user_id,
                    ...defaultSettings
                });
                
                return res.status(201).json({
                    success: true,
                    message: 'Default privacy settings created',
                    data: newSettings
                });
            }

            const updatedSettings = await PrivacySettings.findOne({
                where: { user_id }
            });

            res.status(200).json({
                success: true,
                message: 'Privacy settings reset to defaults',
                data: updatedSettings
            });
        } catch (error) {
            console.error('Error resetting privacy settings:', error);
            res.status(500).json({
                success: false,
                message: 'Error resetting privacy settings',
                error: error.message
            });
        }
    }

    // Get consent history
    static async getConsentHistory(req, res) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user_id = req.user.id;

            const settings = await PrivacySettings.findOne({
                where: { user_id },
                attributes: [
                    'gdprDataCollectionConsent',
                    'allowAnonymousUsageAnalytics',
                    'gdprConsentDate',
                    'analyticsConsentDate',
                    'created_at',
                    'updated_at'
                ]
            });

            if (!settings) {
                return res.status(404).json({
                    success: false,
                    message: 'No privacy settings found'
                });
            }

            res.status(200).json({
                success: true,
                data: {
                    consentHistory: settings,
                    message: 'Consent history retrieved successfully'
                }
            });
        } catch (error) {
            console.error('Error fetching consent history:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching consent history',
                error: error.message
            });
        }
    }
}

module.exports = PrivacySettingsController;