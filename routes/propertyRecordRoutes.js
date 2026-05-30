const express = require("express");
const authMiddleware = require("../Middleware/authMiddleware");
const PropertyRecordController = require("../Controllers/propertyRecordController");
const propertyFactRoutes = require("./propertyFactRoutes");
const propertyTaskRoutes = require("./propertyTaskRoutes");

const router = express.Router();

router.use(authMiddleware);

router.post("/", PropertyRecordController.createPropertyRecord);
router.get("/", PropertyRecordController.listPropertyRecords);
router.get("/:id/documents", PropertyRecordController.listPropertyDocuments);
router.post("/:id/documents", PropertyRecordController.linkPropertyDocument);
router.use("/:propertyId", propertyFactRoutes);
router.use("/:propertyId", propertyTaskRoutes);
router.get("/:id", PropertyRecordController.getPropertyRecord);
router.patch("/:id", PropertyRecordController.updatePropertyRecord);

module.exports = router;
