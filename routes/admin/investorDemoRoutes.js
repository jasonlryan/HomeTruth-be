const router = require("express").Router();
const { QueryTypes } = require("sequelize");
const db = require("../../config/database");
const auth = require("../../Middleware/authMiddleware");
const checkRole = require("../../Middleware/checkRole");

router.use((req, res, next) => {
  const config = db.config;
  if (config.database !== "hometruth_investor_demo" || config.username !== "investor_demo" ||
      config.host !== "127.0.0.1" || Number(config.port) !== 3360) return res.sendStatus(404);
  next();
});
router.use(auth, checkRole(["admin"]));

const portfolio = `
  SELECT p.id, CONCAT_WS(' ',u.first_name,u.last_name) AS ownerName,
    CONCAT_WS(', ',a.address_line_1,a.town_city,a.postcode) AS address,
    IF(EXISTS(SELECT 1 FROM subscriptions s WHERE s.user_id=u.id AND s.plan='pro'
      AND s.status='active' AND s.expires_at>CURRENT_TIMESTAMP),'pro','free') AS plan,
    f.value_json->>'$.property_type' AS propertyType,
    f.value_json->'$.listed_documents' AS listedDocuments
  FROM properties p
  JOIN property_people pp ON pp.property_id=p.id AND pp.relationship_type='owner'
    AND pp.is_primary=1 AND pp.relationship_status='active'
  JOIN users u ON u.id=pp.user_id
  JOIN property_addresses a ON a.property_id=p.id AND a.is_current=1
  JOIN property_facts f ON f.property_id=p.id AND f.fact_namespace='investor_demo'
    AND f.fact_type='portfolio_record' AND f.value_json->>'$.dataset_id'='brighton-demo'
    AND f.value_json->>'$.demo_only'='true'
  WHERE p.source_ref=CONCAT('brighton-demo:',p.id)`;

function select(sql, replacements = {}) {
  return db.query(sql, { type: QueryTypes.SELECT, replacements });
}

function positiveInt(value) {
  return typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

router.get("/portfolio", async (req, res, next) => {
  const { plan = "all", q = "", page = "1", limit = "25" } = req.query;
  if (!["all","free","pro"].includes(plan) || typeof q !== "string" || q.length > 256 ||
      !positiveInt(page) || !positiveInt(limit) || Number(limit) > 100 ||
      !Number.isSafeInteger(Number(page) * Number(limit))) return res.sendStatus(400);

  const params = { plan, q: q.trim(), limit: Number(limit), offset: (Number(page)-1)*Number(limit) };
  const filtered = `FROM (${portfolio}) homes WHERE (:plan = 'all' OR plan = :plan)
    AND (LOCATE(:q,ownerName)>0 OR LOCATE(:q,address)>0 OR :q = '')`;
  try {
    const [totals] = await select(`SELECT COUNT(*) AS \`all\`, COUNT(IF(plan='free',1,NULL)) AS free,
      COUNT(IF(plan='pro',1,NULL)) AS pro FROM (${portfolio}) homes`);
    const [{ total }] = await select(`SELECT COUNT(*) AS total ${filtered}`, params);
    const records = await select(`SELECT id,ownerName,address,plan,propertyType,
      JSON_LENGTH(listedDocuments) AS listedDocumentCount ${filtered} ORDER BY id LIMIT :limit OFFSET :offset`, params);
    res.json({ data: { totals, total, page: Number(page), limit: params.limit, records } });
  } catch (error) { next(error); }
});

router.get("/portfolio/:id", async (req, res, next) => {
  if (!positiveInt(req.params.id)) return res.sendStatus(404);
  const params = { id: Number(req.params.id) };
  try {
    const [home] = await select(`SELECT * FROM (${portfolio}) homes WHERE id = :id`, params);
    if (!home) return res.sendStatus(404);
    const entries = await select(`SELECT value_json FROM property_facts WHERE property_id = :id
      AND fact_namespace='investor_demo' AND fact_type='ledger_entry'
      AND value_json->>'$.dataset_id'='brighton-demo' AND value_json->>'$.demo_only'='true' ORDER BY id`, params);
    const ledgerEntries = entries.map(({ value_json: { date, category, description, vendor, amount, status } }) =>
      ({ date, category, description, vendor, amount, status }));
    res.json({ data: { ...home, ledgerEntries } });
  } catch (error) { next(error); }
});

module.exports = router;
