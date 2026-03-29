const NotificationSettings = require('../../models/notification');

class NotificationSettingsController {
    // Get notification settings for a user
    static async getSettings(req, res) {
        try {
            // Check if user is authenticated
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user_id = req.user.id;
            
            let settings = await NotificationSettings.findOne({
                where: { user_id }
            });

            // If no settings exist, create default settings
            if (!settings) {
                settings = await NotificationSettings.create({
                    user_id,
                    documentAnalysisComplete: true,
                    chatSummaryFollowUps: true,
                    newAiInsightsAvailable: true,
                    propertyAlerts: true,
                    extensionSaveConfirmations: false,
                    tipsAndProductUpdates: false
                });
            }

            res.status(200).json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Error fetching notification settings:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching notification settings',
                error: error.message
            });
        }
    }

    // Update notification settings for a user
    static async updateSettings(req, res) {
        try {
            // Check if user is authenticated
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user_id = req.user.id;
            const updateData = req.body;

            // FIXED: Validate update data
            const validSettings = [
                'documentAnalysisComplete',
                'chatSummaryFollowUps',
                'newAiInsightsAvailable',
                'propertyAlerts',
                'extensionSaveConfirmations',
                'tipsAndProductUpdates'
            ];

            // Filter out invalid settings
            const filteredUpdateData = {};
            for (const [key, value] of Object.entries(updateData)) {
                if (validSettings.includes(key)) {
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

            if (Object.keys(filteredUpdateData).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No valid settings provided for update'
                });
            }

            // Try to update existing settings
            const [updatedRowsCount] = await NotificationSettings.update(
                filteredUpdateData,
                {
                    where: { user_id }
                }
            );

            if (updatedRowsCount === 0) {
                // If no rows were updated, create new settings
                const newSettings = await NotificationSettings.create({
                    user_id,
                    documentAnalysisComplete: true,
                    chatSummaryFollowUps: true,
                    newAiInsightsAvailable: true,
                    propertyAlerts: true,
                    extensionSaveConfirmations: false,
                    tipsAndProductUpdates: false,
                    ...filteredUpdateData
                });
                
                return res.status(201).json({
                    success: true,
                    message: 'Notification settings created',
                    data: newSettings
                });
            }

            // Fetch updated settings to return
            const updatedSettings = await NotificationSettings.findOne({
                where: { user_id }
            });

            res.status(200).json({
                success: true,
                message: 'Notification settings updated successfully',
                data: updatedSettings
            });
        } catch (error) {
            console.error('Error updating notification settings:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating notification settings',
                error: error.message
            });
        }
    }

    // Update specific notification setting
    static async updateSpecificSetting(req, res) {
        try {
            // Check if user is authenticated
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user_id = req.user.id;
            const { setting_name } = req.params;
            const { value } = req.body;

            // Validate setting name
            const validSettings = [
                'documentAnalysisComplete',
                'chatSummaryFollowUps',
                'newAiInsightsAvailable',
                'propertyAlerts',
                'extensionSaveConfirmations',
                'tipsAndProductUpdates'
            ];

            if (!validSettings.includes(setting_name)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid setting name',
                    validSettings
                });
            }

            // Validate value is boolean
            if (typeof value !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'Setting value must be boolean'
                });
            }

            // Try to update existing settings
            const [updatedRowsCount] = await NotificationSettings.update(
                { [setting_name]: value },
                {
                    where: { user_id }
                }
            );

            if (updatedRowsCount === 0) {
                // If no rows were updated, create new settings with this specific setting
                const defaultSettings = {
                    user_id,
                    documentAnalysisComplete: true,
                    chatSummaryFollowUps: true,
                    newAiInsightsAvailable: true,
                    propertyAlerts: true,
                    extensionSaveConfirmations: false,
                    tipsAndProductUpdates: false,
                    [setting_name]: value
                };

                const newSettings = await NotificationSettings.create(defaultSettings);
                
                return res.status(201).json({
                    success: true,
                    message: 'Notification settings created with updated setting',
                    data: newSettings
                });
            }

            // Fetch updated settings to return
            const updatedSettings = await NotificationSettings.findOne({
                where: { user_id }
            });

            res.status(200).json({
                success: true,
                message: `${setting_name} updated successfully`,
                data: updatedSettings
            });
        } catch (error) {
            console.error('Error updating notification setting:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating notification setting',
                error: error.message
            });
        }
    }

    // Reset settings to default for a user
    static async resetSettings(req, res) {
        try {
            // Check if user is authenticated
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user_id = req.user.id;

            const defaultSettings = {
                documentAnalysisComplete: true,
                chatSummaryFollowUps: true,
                newAiInsightsAvailable: true,
                propertyAlerts: true,
                extensionSaveConfirmations: false,
                tipsAndProductUpdates: false
            };

            // Try to update existing settings
            const [updatedRowsCount] = await NotificationSettings.update(
                defaultSettings,
                {
                    where: { user_id }
                }
            );

            if (updatedRowsCount === 0) {
                // If no rows were updated, create new settings with defaults
                const newSettings = await NotificationSettings.create({
                    user_id,
                    ...defaultSettings
                });
                
                return res.status(201).json({
                    success: true,
                    message: 'Default notification settings created',
                    data: newSettings
                });
            }

            // Fetch updated settings to return
            const updatedSettings = await NotificationSettings.findOne({
                where: { user_id }
            });

            res.status(200).json({
                success: true,
                message: 'Notification settings reset to defaults',
                data: updatedSettings
            });
        } catch (error) {
            console.error('Error resetting notification settings:', error);
            res.status(500).json({
                success: false,
                message: 'Error resetting notification settings',
                error: error.message
            });
        }
    }

    // Delete notification settings for a user
    static async deleteSettings(req, res) {
        try {
            // Check if user is authenticated
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const user_id = req.user.id;

            const deletedRowsCount = await NotificationSettings.destroy({
                where: { user_id }
            });

            if (deletedRowsCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No notification settings found for this user'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Notification settings deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting notification settings:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting notification settings',
                error: error.message
            });
        }
    }
}

module.exports = NotificationSettingsController;