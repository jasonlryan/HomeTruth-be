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
  SELECT p.id, u.email, a.postcode, CONCAT_WS(', ',a.address_line_1,a.town_city) AS sourceAddress, CONCAT_WS(' ',u.first_name,u.last_name) AS ownerName,
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

const portfolioColumns = ["id","name","email","address","postcode","propertyType","plan","documents","dataset_id","demo_only"];
const ledgerColumns = ["date","category","description","vendor","amount","status","dataset_id","demo_only"];

function csv(columns, rows) {
  function cell(value) {
    const text = Array.isArray(value) ? JSON.stringify(value) : String(value ?? "");
    const safe = /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  }
  return [columns.join(","), ...rows.map(row => columns.map(key => cell(row[key])).join(","))].join("\r\n") + "\r\n";
}

router.get("/portfolio/export", async (req,res,next) => {
  const format = req.query.format;
  if (!["csv","json"].includes(format)) return res.sendStatus(400);
  try {
    const rows = await select(`SELECT id,ownerName AS name,email,sourceAddress AS address,postcode,
      propertyType,plan,listedDocuments AS documents FROM (${portfolio}) homes ORDER BY id`);
    const data = rows.map(row => ({...row,dataset_id:"brighton-demo",demo_only:true}));
    res.attachment("brighton-addresses." + format);
    if (format === "json") return res.json(data);
    res.type("text/csv").send(csv(portfolioColumns,data));
  } catch (error) { next(error); }
});

router.get(["/portfolio/:id","/portfolio/:id/ledger/export"], async (req, res, next) => {
  if (!positiveInt(req.params.id)) return res.sendStatus(404);
  const params = { id: Number(req.params.id) };
  try {
    const [home] = await select(`SELECT id,ownerName,address,plan,propertyType,listedDocuments FROM (${portfolio}) homes WHERE id = :id`, params);
    if (!home) return res.sendStatus(404);
    const entries = await select(`SELECT value_json FROM property_facts WHERE property_id = :id
      AND fact_namespace='investor_demo' AND fact_type='ledger_entry'
      AND value_json->>'$.dataset_id'='brighton-demo' AND value_json->>'$.demo_only'='true' ORDER BY id`, params);
    const ledgerEntries = entries.map(({ value_json: { date, category, description, vendor, amount, status } }) =>
      ({ date, category, description, vendor, amount, status }));
    if (req.path.endsWith("/ledger/export")) {
      const rows = ledgerEntries.map(row => ({...row,dataset_id:"brighton-demo",demo_only:true}));
      return res.attachment("brighton-" + home.id + "-ledger.csv").type("text/csv").send(csv(ledgerColumns,rows));
    }
    res.json({ data: { ...home, ledgerEntries } });
  } catch (error) { next(error); }
});

const fs = require("node:fs/promises");
const snapshot = require("node:path").join(__dirname,"../../.investor-demo/knowledge.json");
let cachedKnowledge;
async function knowledge() {
  const stat = await fs.stat(snapshot);
  if (cachedKnowledge?.mtime !== stat.mtimeMs) {
    const records = JSON.parse(await fs.readFile(snapshot,"utf8"));
    cachedKnowledge = {mtime:stat.mtimeMs,records};
  }
  return cachedKnowledge.records;
}

router.get("/knowledge", async (req,res,next) => {
  const {q="",page="1",limit="25"} = req.query;
  if (typeof q !== "string" || q.length > 256 || !positiveInt(page) || !positiveInt(limit) || Number(limit)>100) return res.sendStatus(400);
  try {
    const term = q.trim().toLowerCase();
    const rows = (await knowledge()).filter(doc => !term || doc.name.toLowerCase().includes(term) ||
      doc.chunks.some(chunk=>chunk.text.toLowerCase().includes(term)));
    const start = (Number(page)-1)*Number(limit);
    const records = rows.slice(start,start+Number(limit)).map(({id,name,namespace,chunks})=>({id,name,namespace,chunkCount:chunks.length}));
    res.json({data:{total:rows.length,page:Number(page),limit:Number(limit),records}});
  } catch (error) { if (error.code === "ENOENT") return res.sendStatus(503); next(error); }
});
router.get("/knowledge/:id", async (req,res,next) => {
  try {
    const doc = (await knowledge()).find(row=>row.id===req.params.id);
    if (!doc) return res.sendStatus(404);
    res.json({data:{...doc,chunkCount:doc.chunks.length,chunks:doc.chunks.map(({text})=>({text}))}});
  } catch (error) { if (error.code === "ENOENT") return res.sendStatus(503); next(error); }
});

module.exports = router;
