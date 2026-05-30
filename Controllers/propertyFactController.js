const PropertyFactService = require("../services/propertyFactService");

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("Property fact error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Property fact request failed",
  });
};

class PropertyFactController {
  static async listPropertyFacts(req, res) {
    try {
      const data = await PropertyFactService.listPropertyFacts(
        req.user.id,
        req.params.propertyId
      );

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async createPropertyFact(req, res) {
    try {
      const data = await PropertyFactService.createPropertyFact(
        req.user.id,
        req.params.propertyId,
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

  static async createEvidenceSource(req, res) {
    try {
      const data = await PropertyFactService.createEvidenceSource(
        req.user.id,
        req.params.propertyId,
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
}

module.exports = PropertyFactController;
