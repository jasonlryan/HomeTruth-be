const express = require("express");
const authMiddleware = require("../Middleware/authMiddleware");
const PropertyRecordController = require("../Controllers/propertyRecordController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", PropertyRecordController.createPropertyRecord);
router.get("/", PropertyRecordController.listPropertyRecords);
router.get("/:id", PropertyRecordController.getPropertyRecord);
router.patch("/:id", PropertyRecordController.updatePropertyRecord);

module.exports = router;
