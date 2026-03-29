const express = require('express');
const router = express.Router();
const auth = require("../../Middleware/authMiddleware");

const profilePreferencesController = require('../../Controllers/setting/profilePreferences');
router.use(auth);

// GET /api/profile-preferences - Get all profile preferences (admin)
router.get('/all', profilePreferencesController.getAllPreferences);

// GET /api/profile-preferences - Get preferences for authenticated user
router.get('/', profilePreferencesController.getByUserId);

// POST /api/profile-preferences - Create or update preferences for authenticated user
router.post('/', profilePreferencesController.createOrUpdate);

// PUT /api/profile-preferences - Update preferences for authenticated user
router.put('/', profilePreferencesController.updatePreferences);

// DELETE /api/profile-preferences - Delete preferences for authenticated user
router.delete('/', profilePreferencesController.deletePreferences);

module.exports = router;