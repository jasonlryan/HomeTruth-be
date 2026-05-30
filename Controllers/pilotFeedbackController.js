const PilotAnalyticsService = require("../services/pilotAnalyticsService");

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("Pilot feedback error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Pilot feedback request failed",
  });
};

class PilotFeedbackController {
  static async submitFeedback(req, res) {
    try {
      const data = await PilotAnalyticsService.recordFeedback(
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
}

module.exports = PilotFeedbackController;
