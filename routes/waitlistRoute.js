const express = require("express");
const router = express.Router();
const waitlistController = require("../Controllers/waitlistController");

// Join waitlist route
router.post("/join", waitlistController.joinWaitlist);

module.exports = router;

