const PropertyTaskService = require("../services/propertyTaskService");

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("Property task error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Property task request failed",
  });
};

class PropertyTaskController {
  static async listPropertyTasks(req, res) {
    try {
      const data = await PropertyTaskService.listPropertyTasks(
        req.user.id,
        req.params.propertyId,
        {
          status: req.query.status,
        }
      );

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async createFollowUp(req, res) {
    try {
      const { task, created } = await PropertyTaskService.createFollowUp(
        req.user.id,
        req.params.propertyId,
        req.body
      );
      return res.status(created ? 201 : 200).json({ success: true, data: task });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ success: false, message: status === 500 ? "The follow-up could not be saved." : error.message });
    }
  }

  static async getFollowUpPassage(req, res) {
    res.set("Cache-Control", "private, no-store");
    try {
      const data = await PropertyTaskService.getFollowUpPassage(
        req.user.id, req.params.propertyId, req.params.taskId
      );
      return res.json({ success: true, data });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ success: false, message: status === 500 ? "The saved passage could not be opened." : error.message });
    }
  }

  static async generatePropertyTasks(req, res) {
    try {
      const data = await PropertyTaskService.generateTasksForProperty(
        req.user.id,
        req.params.propertyId
      );

      return res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async updatePropertyTask(req, res) {
    try {
      const data = await PropertyTaskService.updateTaskStatus(
        req.user.id,
        req.params.propertyId,
        req.params.taskId,
        req.body
      );

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async listTaskStatusEvents(req, res) {
    try {
      const data = await PropertyTaskService.listTaskStatusEvents(
        req.user.id,
        req.params.propertyId,
        req.params.taskId
      );

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = PropertyTaskController;
