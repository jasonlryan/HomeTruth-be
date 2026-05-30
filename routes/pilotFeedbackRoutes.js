const express = require("express");
const authMiddleware = require("../Middleware/authMiddleware");
const PilotFeedbackController = require("../Controllers/pilotFeedbackController");

const router = express.Router();

router.use(authMiddleware);

router.post("/feedback", PilotFeedbackController.submitFeedback);

module.exports = router;
