const express = require("express");
const authMiddleware = require("../Middleware/authMiddleware");
const PartnerOnboardingController = require("../Controllers/partnerOnboardingController");

const router = express.Router();

router.get("/invites/:code", PartnerOnboardingController.validateInvite);
router.post(
  "/invites/:code/view",
  PartnerOnboardingController.recordInviteViewed
);

router.use(authMiddleware);

router.post("/claim", PartnerOnboardingController.claimInvite);
router.post("/consents", PartnerOnboardingController.recordConsents);
router.post("/property", PartnerOnboardingController.attachProperty);
router.post("/events", PartnerOnboardingController.emitEvent);
router.post("/activity", PartnerOnboardingController.recordDailyActivity);

module.exports = router;
