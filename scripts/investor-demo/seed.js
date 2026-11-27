"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const pdfParse = require("pdf-parse");
const portfolio = require("./fixtures/brighton-addresses.json");
const ledger = require("./fixtures/john-doe-ledger.json");

const dbName = "hometruth_investor_demo";
const dataset = "brighton-demo";
const manualUrl = "https://media3.bosch-home.com/Documents/9001551191_B.pdf";
const manualDigest = "0a16c42ca9930e5511a7c163986b84c2bb73b653fde14da810b5270659268845";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const houseTypes = {
  "Semi-detached": "house", Terraced: "house", Detached: "house",
  "Coach House": "house", Bungalow: "bungalow", Maisonette: "maisonette",
  Flat: "flat", "Converted Loft": "flat",
};

async function seedDocuments(db, storage) {
  // This directory belongs to the isolated demo. Never use the app's live uploads.
  await fs.mkdir(storage, { recursive: true, mode: 0o700 });
  const manual = await fs.readFile(path.join(storage, "bosch-WAN28281GB.pdf"));
  if (sha(manual) !== manualDigest) throw new Error("Bosch manual checksum mismatch");
  const examples = ["survey.pdf", "quote.pdf", "repair-invoice.pdf"];
  const docs = [];
  for (const name of [...examples, "bosch-WAN28281GB.pdf"]) {
    const file = path.join(storage, name);
    if (examples.includes(name)) await fs.copyFile(path.join(__dirname, "fixtures", name), file);
    const bytes = await fs.readFile(file);
    const { text } = await pdfParse(new Uint8Array(bytes));
    if (!text.trim()) throw new Error("No extracted text: " + name);
    docs.push({ file, name, size: bytes.length, text });
  }
  for (const doc of docs) {
    const isManual = doc.name === "bosch-WAN28281GB.pdf";
    const [result] = await db.query(
      'INSERT INTO userDocuments (user_id,name,status,file_path,file_type,file_size,text_content,chunks_count,ai_analysis) VALUES (1001,?,?,?,?,?,?,0,?)',
      [doc.name, "ready", doc.file, ".pdf", doc.size, doc.text,
        JSON.stringify({ dataset_id: "maya-demo", demo_only: true, ...(isManual && { sourceUrl: manualUrl }) })]);
    await db.query("INSERT INTO property_documents (property_id,user_document_id,linked_by_user_id,relevance) VALUES (1001,?,1001,'evidence')", [result.insertId]);
    if (isManual) await db.query("INSERT INTO home_item_evidence (item_id,user_document_id,role,match_status) VALUES (1,?,'manual','user_confirmed')", [result.insertId]);
  }
}

async function insertPortfolio(db) {
  const refs = new Set(portfolio.map(row => row.id));
  if (portfolio.length !== 1000 || refs.size !== 1000 || !portfolio.every(row =>
    Number.isInteger(row.id) && row.id >= 1 && row.id <= 1000 && row.email.endsWith("@demo.example.com") &&
    houseTypes[row.propertyType] && ["free", "pro"].includes(row.plan))) throw new Error("Invalid Brighton fixture");
  const locked = await bcrypt.hash(crypto.randomBytes(48).toString("hex"), 10);
  const maya = { id: 1001, name: "Maya Demo", email: "maya.demo@example.invalid", address: "18 Alder Walk, Exampleton", postcode: null, propertyType: "Terraced", plan: "free" };
  const rows = [...portfolio, maya];
  const users = [], properties = [], addresses = [], owners = [], facts = [], subscriptions = [];
  for (const row of rows) {
    const ref = row === maya ? "maya-demo:home" : dataset + ":" + row.id;
    const [first, ...last] = row.name.split(" ");
    users.push([row.id, first, last.join(" "), row.email, row === maya ? await bcrypt.hash(process.env.MAYA_PASSWORD, 10) : locked, row.plan === "pro" ? "pro" : "user", 1, row.address]);
    properties.push([row.id, houseTypes[row.propertyType], "active", "import", ref, row.id]);
    const split = row.address.lastIndexOf(",");
    const line = row.address.slice(0,split).trim(), city = row.address.slice(split+1).trim();
    const fingerprint = sha([line,city,row.postcode,"GB"].filter(Boolean).map(v=>v.toLowerCase()).join("|"));
    addresses.push([row.id,line,city,row.postcode,"GB","import",fingerprint]);
    owners.push([row.id,row.id,"owner","active","manage",1,"system",ref]);
    if (row === maya) continue;
    if (row.plan === "pro") subscriptions.push([row.id,"pro","active","2099-12-31"]);
    facts.push([row.id,"investor_demo","portfolio_record",JSON.stringify({dataset_id:dataset,demo_only:true,version:1,source_id:row.id,property_type:row.propertyType,listed_documents:row.documents}),"system"]);
  }
  for (const entry of ledger) facts.push([1,"investor_demo","ledger_entry",JSON.stringify({...entry,dataset_id:dataset,demo_only:true}),"system"]);
  await db.query("INSERT INTO users (id,first_name,last_name,email,password,role,is_verified,home_address) VALUES ?",[users]);
  await db.query("INSERT INTO users (first_name,last_name,email,password,role,is_verified) VALUES ('Local','Admin','admin.demo@example.invalid',?,'admin',1)",[await bcrypt.hash(process.env.ADMIN_PASSWORD,10)]);
  await db.query("INSERT INTO properties (id,property_type,lifecycle_status,source_type,source_ref,created_by_user_id) VALUES ?",[properties]);
  await db.query("INSERT INTO property_addresses (property_id,address_line_1,town_city,postcode,country,source_type,address_fingerprint) VALUES ?",[addresses]);
  await db.query("INSERT INTO property_people (property_id,user_id,relationship_type,relationship_status,permission_level,is_primary,source_type,source_ref) VALUES ?",[owners]);
  await db.query("INSERT INTO subscriptions (user_id,plan,status,expires_at) VALUES ?",[subscriptions]);
  await db.query("INSERT INTO property_facts (property_id,fact_namespace,fact_type,value_json,created_from) VALUES ?",[facts]);
  for (const [id,name,model] of [[1,"Kitchen washing machine","WAN28281GB"],[2,"Utility room washing machine","WAN28201GB"]]) {
    const record = {name,category:"appliance",identity:{brand:"Bosch",model,method:"manual"},purchase:{},warranty:{},values:{},history:[]};
    await db.query("INSERT INTO home_items (id,property_id,created_by_user_id,request_key,record) VALUES (?,1001,1001,?,?)",[id,crypto.randomUUID(),JSON.stringify(record)]);
  }
}

async function main() {
  const e = process.env;
  if (e.DB_NAME !== dbName || e.DB_HOST !== "127.0.0.1" || e.DB_USER !== "investor_demo" || !e.DB_PASSWORD ||
      e.DB_PORT !== "3360" || !e.MAYA_PASSWORD || !e.ADMIN_PASSWORD || !e.DEMO_STORAGE || !path.isAbsolute(e.DEMO_STORAGE)) {
    throw new Error("Expected dedicated local investor demo settings. See the README.");
  }
  const db = await mysql.createConnection({host:e.DB_HOST,port:Number(e.DB_PORT),user:e.DB_USER,password:e.DB_PASSWORD,database:e.DB_NAME});
  try {
    const [[lock]] = await db.query("SELECT GET_LOCK('ht360-fixture-seed', 5) AS acquired");
    if (lock.acquired !== 1) throw new Error("Another seed is running");
    const files = (await fs.readdir(path.join(__dirname,"../../migrations"))).filter(f=>f.endsWith(".js")).sort();
    const [meta] = await db.query("SELECT name FROM SequelizeMeta ORDER BY name");
    if (JSON.stringify(files)!==JSON.stringify(meta.map(r=>r.name))) throw new Error("Apply this revision's migrations before seeding");
    await db.beginTransaction();
    const [[counts]] = await db.query("SELECT (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM properties) homes");
    if (counts.users || counts.homes) throw new Error("Database already populated; use a fresh demo volume");
    await insertPortfolio(db);
    await seedDocuments(db,e.DEMO_STORAGE);
    await db.commit();
    console.log("Seeded Brighton portfolio and John’s ledger, Maya’s home, two appliances and four PDFs.");
  } catch (error) {
    await db.rollback();
    throw error;
  } finally { await db.end(); }
}

main().catch(error => { console.error(error.code || error.message); process.exitCode=1; });
