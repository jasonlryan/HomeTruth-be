const express = require("express");
const authMiddleware = require("../Middleware/authMiddleware");
const controller = require("../Controllers/partnerProgrammeAccessController");

const router = express.Router();
const individualResources = [
  "homeowners",
  "members",
  "properties",
  "documents",
  "tasks",
  "profiles",
  "chats",
  "events",
];

router.use(authMiddleware);
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.get("/access-status", controller.status);
router.get("/", controller.list);
router.get("/:id", controller.get);
router.get("/:id/audit-events", controller.audit);
router.get("/:id/evidence", controller.evidence);
router.get("/:id/evidence/export", controller.evidenceExport);
router.get("/:id/evidence/definitions", controller.evidenceDefinitions);
for (const resourceType of individualResources) {
  router.all(`/:id/${resourceType}/*`, (req, res, next) => {
    req.params.resourceType = resourceType;
    return controller.denyIndividual(req, res, next);
  });
  router.all(`/:id/${resourceType}`, (req, res, next) => {
    req.params.resourceType = resourceType;
    return controller.denyIndividual(req, res, next);
  });
}

module.exports = router;
