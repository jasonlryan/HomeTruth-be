const express = require('express');
const router = express.Router();
const NotificationSettingsController = require('../../Controllers/setting/notification');
const auth = require("../../Middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(auth);

// GET /api/notification-settings/ - Get notification settings for the authenticated user
router.get('/', NotificationSettingsController.getSettings);

// PUT /api/notification-settings/ - Update all notification settings for the authenticated user
router.put('/', NotificationSettingsController.updateSettings);

// PATCH /api/notification-settings/:setting_name - Update specific notification setting
router.patch('/:setting_name', NotificationSettingsController.updateSpecificSetting);

// POST /api/notification-settings/reset - Reset settings to default
router.post('/reset', NotificationSettingsController.resetSettings);

// DELETE /api/notification-settings/ - Delete notification settings for the authenticated user
router.delete('/', NotificationSettingsController.deleteSettings);

module.exports = router;
