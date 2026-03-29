const express = require("express");
const router = express.Router();
const authMiddleware = require("../../Middleware/authMiddleware");
const checkRole = require("../../Middleware/checkRole");
const controller = require("../../Controllers/admin/adminArticleController");

router.use(authMiddleware);
router.use(checkRole(["admin"]));

router.get("/", controller.listArticles);
router.get("/:id", controller.getArticle);
router.post("/", controller.upload, controller.createArticle);
router.put("/:id", controller.upload, controller.updateArticle);
router.delete("/:id", controller.deleteArticle);
router.patch("/:id/publish", controller.publishArticle);
router.patch("/:id/unpublish", controller.unpublishArticle);

module.exports = router;
