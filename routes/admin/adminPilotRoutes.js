const express = require("express");
const authMiddleware = require("../../Middleware/authMiddleware");
const checkRole = require("../../Middleware/checkRole");
const AdminPilotController = require("../../Controllers/admin/adminPilotController");

const router = express.Router();

router.use(authMiddleware);
router.use(checkRole(["admin"]));

router.get("/cohort-report", AdminPilotController.getCohortReport);

module.exports = router;
