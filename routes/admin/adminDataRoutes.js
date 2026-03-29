const express = require("express");
const router = express.Router();
const authMiddleware = require("../../Middleware/authMiddleware");
const checkRole = require("../../Middleware/checkRole");
const controller = require("../../Controllers/admin/adminDataController");

router.use(authMiddleware);
router.use(checkRole(["admin"]));

// Export must be defined before /:id to avoid route conflict
router.get("/export", controller.exportUsers);
router.get("/", controller.getUsers);
router.get("/:id", controller.getUserDetail);

module.exports = router;
