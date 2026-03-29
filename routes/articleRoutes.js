const express = require("express");
const router = express.Router();
const controller = require("../Controllers/articleController");

router.get("/", controller.listPublished);
router.get("/:slug", controller.getBySlug);

module.exports = router;
