const express = require("express");
const authMiddleware = require("../../Middleware/authMiddleware");
const checkRole = require("../../Middleware/checkRole");
const controller = require("../../Controllers/admin/adminPartnerProgrammeController");
const accessController = require("../../Controllers/admin/adminPartnerAccessController");

const router = express.Router();

router.use(authMiddleware);
router.use(checkRole(["admin"]));

router.get("/partners", controller.listPartners);
router.get("/programmes", controller.listProgrammes);
router.get("/programmes/:id", controller.getProgramme);
router.post("/programmes", controller.createProgramme);
router.patch("/programmes/:id", controller.updateProgramme);
router.post("/programmes/:id/transitions", controller.transitionProgramme);
router.get("/programmes/:id/access-assignments", accessController.list);
router.post("/programmes/:id/access-assignments", accessController.grant);
router.patch(
  "/programmes/:id/access-assignments/:accessId",
  accessController.changeRole
);
router.post(
  "/programmes/:id/access-assignments/:accessId/revoke",
  accessController.revoke
);

module.exports = router;
