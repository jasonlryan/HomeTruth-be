const { getPage } = require("../services/surveyPassageService");

async function getPdfPage(req, res) {
  res.set("Cache-Control", "private, no-store");
  try {
    const data = await getPage(req.user.id, Number(req.params.id), Number(req.query.page));
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: status === 500 ? "The PDF page could not be opened." : error.message });
  }
}

module.exports = { getPdfPage };
