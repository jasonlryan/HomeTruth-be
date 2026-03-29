const AdminDashboardService = require("../../services/adminDashboardService");

const VALID_PERIODS = ["7d", "30d", "90d", "all"];

function parsePeriod(query) {
  const period = query?.period;
  return VALID_PERIODS.includes(period) ? period : "30d";
}

const adminDashboardController = {
  async getKPIs(req, res) {
    try {
      const period = parsePeriod(req.query);
      const data = await AdminDashboardService.getKPIs(period);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching dashboard KPIs:", error);
      res.status(500).json({ success: false, message: "Failed to fetch KPIs", error: error.message });
    }
  },

  async getSignupsChart(req, res) {
    try {
      const period = parsePeriod(req.query);
      const data = await AdminDashboardService.getSignupsChart(period);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching signups chart:", error);
      res.status(500).json({ success: false, message: "Failed to fetch signups chart", error: error.message });
    }
  },

  async getAIUsageChart(req, res) {
    try {
      const period = parsePeriod(req.query);
      const data = await AdminDashboardService.getAIUsageChart(period);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching AI usage chart:", error);
      res.status(500).json({ success: false, message: "Failed to fetch AI usage chart", error: error.message });
    }
  },

  async getDocumentsChart(req, res) {
    try {
      const period = parsePeriod(req.query);
      const data = await AdminDashboardService.getDocumentsChart(period);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching documents chart:", error);
      res.status(500).json({ success: false, message: "Failed to fetch documents chart", error: error.message });
    }
  },

  async getDocCategoriesChart(req, res) {
    try {
      const data = await AdminDashboardService.getDocCategoriesChart();
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching doc categories chart:", error);
      res.status(500).json({ success: false, message: "Failed to fetch doc categories chart", error: error.message });
    }
  },

  async getRecentSignups(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const data = await AdminDashboardService.getRecentSignups(limit);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching recent signups:", error);
      res.status(500).json({ success: false, message: "Failed to fetch recent signups", error: error.message });
    }
  },

  async getRecentUploads(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const data = await AdminDashboardService.getRecentUploads(limit);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching recent uploads:", error);
      res.status(500).json({ success: false, message: "Failed to fetch recent uploads", error: error.message });
    }
  },

  async getRecentAIActivity(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const data = await AdminDashboardService.getRecentAIActivity(limit);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching recent AI activity:", error);
      res.status(500).json({ success: false, message: "Failed to fetch recent AI activity", error: error.message });
    }
  },
};

module.exports = adminDashboardController;
