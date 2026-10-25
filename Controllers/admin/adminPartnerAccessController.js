const PartnerAccessService = require("../../services/partnerAccessService");

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) console.error("Partner access admin error:", error);
  return res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? "Partner access request failed" : error.message,
  });
};

class AdminPartnerAccessController {
  static async list(req, res) {
    try {
      return res.json({
        success: true,
        data: await PartnerAccessService.listAssignments(req.params.id),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async grant(req, res) {
    try {
      return res.status(201).json({
        success: true,
        data: await PartnerAccessService.grantAccess(
          req.params.id,
          req.body,
          req.user.id
        ),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async changeRole(req, res) {
    try {
      return res.json({
        success: true,
        data: await PartnerAccessService.changeRole(
          req.params.id,
          req.params.accessId,
          req.body.role,
          req.user.id
        ),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async revoke(req, res) {
    try {
      return res.json({
        success: true,
        data: await PartnerAccessService.revokeAccess(
          req.params.id,
          req.params.accessId,
          req.user.id
        ),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = AdminPartnerAccessController;
