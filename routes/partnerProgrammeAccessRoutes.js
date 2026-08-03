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
router.get("/access-status", controller.status);
router.get("/", controller.list);
router.get("/:id", controller.get);
router.get("/:id/audit-events", controller.audit);
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
