const ProfilePreferences = require('../../models/profilePreferences');

const validBehaviors = ['follow_ups', 'link_notes', 'checklist'];
const validCommunicationTones = ['formal', 'friendly', 'encouraging'];
const validCommunicationStyles = ['bullet_points', 'narrative_summary', 'visual_aids'];

const profilePreferencesController = {
    // Create or update profile preferences
    createOrUpdate: async (req, res) => {
        try {
            const user_id = req.user.id;
            const {
                communication_tone,
                communication_style,
                behavior,
                use_profile_personalization
            } = req.body;

            // // Log the received data for debugging
            // console.log('Request body:', req.body);
            // console.log('Extracted values:', { communication_tone, communication_style, behavior, use_profile_personalization });

            // Validation for communication_tone
            if (communication_tone && !validCommunicationTones.includes(communication_tone)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid communication_tone value. Valid values are: ${validCommunicationTones.join(', ')}`
                });
            }

            // Validation for communication_style
            if (communication_style && !validCommunicationStyles.includes(communication_style)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid communication_style value. Valid values are: ${validCommunicationStyles.join(', ')}`
                });
            }

            // Validation for behavior
            if (behavior && !validBehaviors.includes(behavior)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid behavior value. Valid values are: ${validBehaviors.join(', ')}`
                });
            }

            // Prepare data for upsert
            const upsertData = {
                user_id: parseInt(user_id),
                communication_tone,
                communication_style,
                behavior,
                use_profile_personalization
            };

            // console.log('Data being upserted:', upsertData);

            // Use upsert with conflict resolution on user_id
            const [preferences, created] = await ProfilePreferences.upsert(upsertData, {
                conflictFields: ['user_id'],
                returning: true
            });

            // console.log('Upsert result:', { preferences: preferences.toJSON(), created });

            res.status(created ? 201 : 200).json({
                success: true,
                message: created ? 'Profile preferences created successfully' : 'Profile preferences updated successfully',
                data: preferences
            });
        } catch (error) {
            console.error('Error creating/updating profile preferences:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to save profile preferences',
                error: error.message
            });
        }
    },

    // Get profile preferences by user ID
    getByUserId: async (req, res) => {
        try {
            const user_id = req.user.id;

            const preferences = await ProfilePreferences.findOne({
                where: { user_id: parseInt(user_id) }
            });

            if (!preferences) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile preferences not found for this user'
                });
            }

            res.status(200).json({
                success: true,
                data: preferences
            });
        } catch (error) {
            console.error('Error fetching profile preferences:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch profile preferences',
                error: error.message
            });
        }
    },

    // Update specific preference fields
    updatePreferences: async (req, res) => {
        try {
            const user_id = req.user.id;
            const updateData = req.body;

            console.log('Update data received:', updateData);

            // Validation for communication_tone
            if (updateData.communication_tone && !validCommunicationTones.includes(updateData.communication_tone)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid communication_tone value. Valid values are: ${validCommunicationTones.join(', ')}`
                });
            }

            // Validation for communication_style
            if (updateData.communication_style && !validCommunicationStyles.includes(updateData.communication_style)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid communication_style value. Valid values are: ${validCommunicationStyles.join(', ')}`
                });
            }

            // Validation for behavior
            if (updateData.behavior && !validBehaviors.includes(updateData.behavior)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid behavior value. Valid values are: ${validBehaviors.join(', ')}`
                });
            }

            // Filter out undefined values to avoid overwriting with null
            const filteredUpdateData = Object.fromEntries(
                Object.entries(updateData).filter(([key, value]) => value !== undefined)
            );

            console.log('Filtered update data:', filteredUpdateData);

            const [updatedRowsCount] = await ProfilePreferences.update(
                filteredUpdateData,
                {
                    where: { user_id: parseInt(user_id) },
                    returning: true
                }
            );

            if (updatedRowsCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile preferences not found for this user'
                });
            }

            // Fetch the updated preferences
            const updatedPreferences = await ProfilePreferences.findOne({
                where: { user_id: parseInt(user_id) }
            });

            res.status(200).json({
                success: true,
                message: 'Profile preferences updated successfully',
                data: updatedPreferences
            });
        } catch (error) {
            console.error('Error updating profile preferences:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update profile preferences',
                error: error.message
            });
        }
    },

    // Delete profile preferences
    deletePreferences: async (req, res) => {
        try {
            const user_id = req.user.id;

            const deletedRowsCount = await ProfilePreferences.destroy({
                where: { user_id: parseInt(user_id) }
            });

            if (deletedRowsCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile preferences not found for this user'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Profile preferences deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting profile preferences:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete profile preferences',
                error: error.message
            });
        }
    },

    // Get all profile preferences (admin function)
    getAllPreferences: async (req, res) => {
        try {
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;

            const { count, rows } = await ProfilePreferences.findAndCountAll({
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['createdAt', 'DESC']]
            });

            res.status(200).json({
                success: true,
                data: {
                    preferences: rows,
                    pagination: {
                        total: count,
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(count / limit),
                        hasNextPage: page * limit < count,
                        hasPrevPage: page > 1
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching all profile preferences:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch profile preferences',
                error: error.message
            });
        }
    }
};

module.exports = profilePreferencesController;