const express = require("express");
const PropertyFactController = require("../Controllers/propertyFactController");

const router = express.Router({ mergeParams: true });

router.get("/facts", PropertyFactController.listPropertyFacts);
router.post("/facts", PropertyFactController.createPropertyFact);
router.post("/evidence-sources", PropertyFactController.createEvidenceSource);

module.exports = router;
