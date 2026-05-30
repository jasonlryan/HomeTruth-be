const PropertyRecordService = require("../services/propertyRecordService");

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("Property record error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Property record request failed",
  });
};

class PropertyRecordController {
  static async createPropertyRecord(req, res) {
    try {
      const data = await PropertyRecordService.createPropertyRecord(
        req.user.id,
        req.body
      );

      return res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async listPropertyRecords(req, res) {
    try {
      const data = await PropertyRecordService.listPropertyRecords(req.user.id);

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async getPropertyRecord(req, res) {
    try {
      const data = await PropertyRecordService.getPropertyRecord(
        req.user.id,
        req.params.id
      );

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async updatePropertyRecord(req, res) {
    try {
      const data = await PropertyRecordService.updatePropertyRecord(
        req.user.id,
        req.params.id,
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
}

module.exports = PropertyRecordController;
