const express = require("express");
const router = express.Router();
const authMiddleware = require("../../Middleware/authMiddleware");
const checkRole = require("../../Middleware/checkRole");
const controller = require("../../Controllers/admin/adminDashboardController");

router.use(authMiddleware);
router.use(checkRole(["admin"]));

router.get("/kpis", controller.getKPIs);
router.get("/charts/signups", controller.getSignupsChart);
router.get("/charts/ai-usage", controller.getAIUsageChart);
router.get("/charts/documents", controller.getDocumentsChart);
router.get("/charts/doc-categories", controller.getDocCategoriesChart);
router.get("/recent/signups", controller.getRecentSignups);
router.get("/recent/uploads", controller.getRecentUploads);
router.get("/recent/ai-activity", controller.getRecentAIActivity);

module.exports = router;
