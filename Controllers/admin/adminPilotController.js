const PilotAnalyticsService = require("../../services/pilotAnalyticsService");

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("Admin pilot reporting error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Pilot reporting request failed",
  });
};

class AdminPilotController {
  static async getCohortReport(req, res) {
    try {
      const data = await PilotAnalyticsService.getCohortReport({
        period: req.query.period,
        partnerId: req.query.partnerId || req.query.partner_id,
        cohortId: req.query.cohortId || req.query.cohort_id,
      });

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = AdminPilotController;
