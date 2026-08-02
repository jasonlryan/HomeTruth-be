const PartnerOnboardingService = require("../services/partnerOnboardingService");

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("Partner onboarding error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Partner onboarding request failed",
    inviteStatus: error.inviteStatus,
  });
};

class PartnerOnboardingController {
  static async validateInvite(req, res) {
    try {
      const data = await PartnerOnboardingService.validateInvite(req.params.code);
      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async claimInvite(req, res) {
    try {
      const data = await PartnerOnboardingService.claimInvite(
        req.user.id,
        req.body.inviteCode || req.body.invite_code
      );

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async recordConsents(req, res) {
    try {
      const data = await PartnerOnboardingService.recordConsents(
        req.user.id,
        req.body.inviteCode || req.body.invite_code,
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

  static async attachProperty(req, res) {
    try {
      const data = await PartnerOnboardingService.attachProperty(
        req.user.id,
        req.body.inviteCode || req.body.invite_code,
        req.body.propertyId || req.body.property_id
      );

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async emitEvent(req, res) {
    try {
      const data = await PartnerOnboardingService.emitEvent(
        req.user?.id,
        req.body
      );

      return res.status(202).json({
        success: true,
        data,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async recordDailyActivity(req, res) {
    try {
      const { recorded, deduplicated } =
        await PartnerOnboardingService.recordDailyActivity(req.user.id);
      return res.status(202).json({
        success: true,
        data: { recorded, deduplicated: Boolean(deduplicated) },
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = PartnerOnboardingController;
