const express = require('express');
const router = express.Router();
const PrivacySettingsController = require('../../Controllers/setting/privacyController');
const auth = require("../../Middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(auth);

// GET /api/privacy-settings/ - Get privacy settings for the authenticated user
router.get('/', PrivacySettingsController.getSettings);

// PUT /api/privacy-settings/ - Update all privacy settings for the authenticated user
router.put('/', PrivacySettingsController.updateSettings);

// PATCH /api/privacy-settings/:setting_name - Update specific privacy setting
router.patch('/:setting_name', PrivacySettingsController.updateSpecificSetting);

// POST /api/privacy-settings/reset - Reset settings to default
router.post('/reset', PrivacySettingsController.resetSettings);

// GET /api/privacy-settings/export - Export user data (GDPR compliance)
router.get('/export', PrivacySettingsController.exportUserData);

// DELETE /api/privacy-settings/delete-account - Delete user account and all data
router.delete('/', PrivacySettingsController.deleteUserData);

// GET /api/privacy-settings/consent-history - Get consent history
router.get('/consent-history', PrivacySettingsController.getConsentHistory);

module.exports = router;
