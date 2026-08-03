const express = require("express");
const authMiddleware = require("../../Middleware/authMiddleware");
const checkRole = require("../../Middleware/checkRole");
const controller = require("../../Controllers/admin/adminPartnerProgrammeController");

const router = express.Router();

router.use(authMiddleware);
router.use(checkRole(["admin"]));

router.get("/partners", controller.listPartners);
router.get("/programmes", controller.listProgrammes);
router.get("/programmes/:id", controller.getProgramme);
router.post("/programmes", controller.createProgramme);
router.patch("/programmes/:id", controller.updateProgramme);
router.post("/programmes/:id/transitions", controller.transitionProgramme);

module.exports = router;
