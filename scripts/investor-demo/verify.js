"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const mysql = require("mysql2/promise");
const expected = require("./fixtures/brighton-addresses.json");
const ledger = require("./fixtures/john-doe-ledger.json");

async function verify() {
  const e = process.env;
  assert.equal(e.DB_HOST,"127.0.0.1");
  assert.equal(e.DB_NAME,"hometruth_investor_demo");
  const db = await mysql.createConnection({host:e.DB_HOST,port:Number(e.DB_PORT),database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
  try {
    const [rows] = await db.query(`
      SELECT p.id, u.first_name,u.last_name,u.email, a.address_line_1,a.town_city,a.postcode,
        s.plan, f.value_json FROM properties p JOIN property_people pp ON pp.property_id=p.id AND pp.relationship_type='owner'
      JOIN users u ON u.id=pp.user_id JOIN property_addresses a ON a.property_id=p.id AND a.is_current=1
      JOIN property_facts f ON f.property_id=p.id AND f.fact_namespace='investor_demo' AND f.fact_type='portfolio_record'
      LEFT JOIN subscriptions s ON s.user_id=u.id AND s.status='active' ORDER BY p.id`);
    const records = rows.map(r=>({
      id:r.value_json.source_id,name:[r.first_name,r.last_name].filter(Boolean).join(" "),email:r.email,
      address:r.address_line_1+", "+r.town_city,postcode:r.postcode,propertyType:r.value_json.property_type,
      plan:r.plan||"free",documents:r.value_json.listed_documents
    }));
    assert.deepEqual(records,expected);
    assert(rows.every(r=>r.value_json.demo_only===true && r.value_json.dataset_id==='brighton-demo'));
    const [entries] = await db.query("SELECT value_json FROM property_facts WHERE property_id=1 AND fact_type='ledger_entry' ORDER BY id");
    assert.deepEqual(entries.map(({value_json:{demo_only,dataset_id,...entry}})=>entry),ledger);
    const [docs] = await db.query("SELECT file_path,file_size,text_content FROM userDocuments WHERE user_id=1001");
    assert.equal(docs.length,4);
    for (const doc of docs) { assert.equal((await fs.stat(doc.file_path)).size,doc.file_size); assert(doc.text_content.trim()); }
    const [items] = await db.query("SELECT i.record, count(e.id) manuals FROM home_items i LEFT JOIN home_item_evidence e ON e.item_id=i.id AND e.role='manual' WHERE i.property_id=1001 GROUP BY i.id ORDER BY i.id");
    assert.deepEqual(items.map(i=>[i.record.name,i.manuals]),[["Kitchen washing machine",1],["Utility room washing machine",0]]);
    const [tables] = await db.query("SHOW TABLES");
    const structures=[];
    for (const table of tables.map(t=>Object.values(t)[0]).sort()) {
      const [[ddl]] = await db.query("SHOW CREATE TABLE ??",[table]);
      structures.push(ddl["Create Table"].replace(/ AUTO_INCREMENT=\d+/g,""));
    }
    console.log(JSON.stringify({records:records.length,pro:records.filter(r=>r.plan==="pro").length,listedDocuments:records.flatMap(r=>r.documents).length,ledgerEntries:entries.length,mayaDocuments:docs.length,tables:tables.length,schemaHash:crypto.createHash("sha256").update(structures.join("\n")).digest("hex")}));
  } finally { await db.end(); }
}
verify().catch(error=>{console.error(error.message);process.exitCode=1;});
