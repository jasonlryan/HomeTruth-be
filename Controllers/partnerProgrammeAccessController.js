const PartnerAccessService = require("../services/partnerAccessService");

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) console.error("Partner programme access error:", error);
  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "Partner programme request failed"
        : error.message || "Partner programme request failed",
  });
};

class PartnerProgrammeAccessController {
  static async evidence(req, res) {
    try {
      const service = require("../services/partnerEvidenceService");
      return res.json({ success: true, data: await service.report(req.user.id, req.params.id, req.query) });
    } catch (error) { return handleError(res, error); }
  }

  static async evidenceExport(req, res) {
    try {
      const service = require("../services/partnerEvidenceService");
      const data = await service.report(req.user.id, req.params.id, req.query, true);
      if (data.state === "approval_required") return res.status(403).json({ success: false, message: data.message });
      res.set("Content-Disposition", 'attachment; filename="programme-evidence.json"');
      return res.json(data);
    } catch (error) { return handleError(res, error); }
  }

  static async evidenceDefinitions(req, res) {
    try {
      const service = require("../services/partnerEvidenceService");
      return res.json({ success: true, data: await service.definitions(req.user.id, req.params.id) });
    } catch (error) { return handleError(res, error); }
  }

  static async list(req, res) {
    try {
      return res.json({
        success: true,
        data: await PartnerAccessService.listMyProgrammes(req.user.id),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async status(req, res) {
    try {
      return res.json({
        success: true,
        data: await PartnerAccessService.hasAnyAccess(req.user.id),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async get(req, res) {
    try {
      return res.json({
        success: true,
        data: await PartnerAccessService.getProgramme(req.user.id, req.params.id),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async audit(req, res) {
    try {
      return res.json({
        success: true,
        data: await PartnerAccessService.getAuditEvents(req.user.id, req.params.id),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  static async denyIndividual(req, res) {
    try {
      await PartnerAccessService.denyIndividualResource(
        req.user.id,
        req.params.id,
        req.params.resourceType
      );
    } catch (error) {
      return handleError(res, error);
    }
    return res.status(403).json({
      success: false,
      message: "Partner programme access is not permitted",
    });
  }
}

module.exports = PartnerProgrammeAccessController;
