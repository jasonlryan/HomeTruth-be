const express = require("express");
const PropertyTaskController = require("../Controllers/propertyTaskController");

const router = express.Router({ mergeParams: true });

router.get("/tasks", PropertyTaskController.listPropertyTasks);
router.post("/tasks/generate", PropertyTaskController.generatePropertyTasks);
router.patch("/tasks/:taskId", PropertyTaskController.updatePropertyTask);
router.get(
  "/tasks/:taskId/status-events",
  PropertyTaskController.listTaskStatusEvents
);

module.exports = router;
