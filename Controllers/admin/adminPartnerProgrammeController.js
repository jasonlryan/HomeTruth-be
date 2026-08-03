const PartnerProgrammeService = require("../../services/partnerProgrammeService");

const handleError = (res, error) => {
  const isDuplicate = error.name === "SequelizeUniqueConstraintError";
  const statusCode = error.statusCode || (isDuplicate ? 409 : 500);
  if (statusCode >= 500) console.error("Partner programme admin error:", error);
  return res.status(statusCode).json({
    success: false,
    message: isDuplicate
      ? "A partner programme, campaign or cohort already uses that key"
      : statusCode >= 500
        ? "Partner programme request failed"
        : error.message || "Partner programme request failed",
  });
};

class AdminPartnerProgrammeController {
  static async listPartners(req, res) {
    try {
      return res.json({ success: true, data: await PartnerProgrammeService.listPartners() });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async listProgrammes(req, res) {
    try {
      const data = await PartnerProgrammeService.listProgrammes({
        status: req.query.status,
        partnerId: req.query.partnerId || req.query.partner_id,
      });
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async getProgramme(req, res) {
    try {
      return res.json({
        success: true,
        data: await PartnerProgrammeService.getProgramme(req.params.id),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async createProgramme(req, res) {
    try {
      const data = await PartnerProgrammeService.createProgramme(req.body, req.user.id);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async updateProgramme(req, res) {
    try {
      return res.json({
        success: true,
        data: await PartnerProgrammeService.updateProgramme(
          req.params.id,
          req.body,
          req.user.id
        ),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async transitionProgramme(req, res) {
    try {
      return res.json({
        success: true,
        data: await PartnerProgrammeService.transitionProgramme(
          req.params.id,
          req.body.status,
          req.user.id
        ),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = AdminPartnerProgrammeController;
