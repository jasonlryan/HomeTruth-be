const assert = require("node:assert/strict");
const fs = require("node:fs");
const expectedLedger = require("./fixtures/john-doe-ledger.json");
const env = require("dotenv").parse(fs.readFileSync(".investor-demo/local.env"));
const origin = "http://127.0.0.1:8360";
const path = "/api/admin/investor-demo/portfolio";

async function login(email, password) {
  const response = await fetch(origin + "/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return (await response.json()).data.token;
}

async function main() {
  const admin = await login("admin.demo@example.invalid", env.ADMIN_PASSWORD);
  const maya = await login("maya.demo@example.invalid", env.MAYA_PASSWORD);
  const get = (suffix, token) => fetch(origin + path + suffix, { headers: token ? { authorization: token } : {} });
  for (const suffix of ["", "/1", "/export?format=csv", "/1/ledger/export"]) {
    assert.equal((await get(suffix)).status, 401);
    assert.equal((await get(suffix, maya)).status, 403);
  }
  async function data(suffix) {
    const response = await get(suffix, admin);
    assert.equal(response.status, 200, suffix);
    return (await response.json()).data;
  }
  const all = await data("");
  assert.deepEqual(all.totals, { all: 1000, free: 557, pro: 443 });
  assert.equal(all.records.length, 25);
  for (const [plan, total] of Object.entries(all.totals)) assert.equal((await data("?plan=" + plan)).total, total);
  assert.equal((await data("?q=Maya%20Demo")).total, 0);
  assert.equal((await get("/1001", admin)).status, 404);
  const john = (await data("?q=John%20Doe")).records.find(row => row.ownerName === "John Doe");
  const detail = await data("/" + john.id);
  assert.equal(detail.listedDocuments.length, john.listedDocumentCount);
  assert.deepEqual(detail.ledgerEntries, expectedLedger);
  const exported = await (await get("/export?format=json",admin)).json();
  assert.deepEqual(exported, require("./fixtures/brighton-addresses.json").map(row=>({...row,dataset_id:"brighton-demo",demo_only:true})));
  assert.equal((await (await get("/export?format=csv",admin)).text()).trim().split("\r\n").length,1001);
  assert.equal((await (await get("/1/ledger/export",admin)).text()).trim().split("\r\n").length,14);
  assert.equal((await get("/1001/ledger/export",admin)).status,404);
  const knowledge = origin + "/api/admin/investor-demo/knowledge";
  assert.equal((await fetch(knowledge)).status,401);
  assert.equal((await fetch(knowledge,{headers:{authorization:maya}})).status,403);
  const headers = {authorization:admin};
  const listing = (await (await fetch(knowledge,{headers})).json()).data;
  assert(listing.total > 0);
  const first = listing.records[0];
  const record = (await (await fetch(knowledge + "/" + first.id,{headers})).json()).data;
  assert.equal(record.chunks.length,first.chunkCount);
  assert(record.chunks.every(chunk=>chunk.text.trim()));
  console.log("Verified 3 exports and the isolated knowledge reader:",listing.total,"documents.");
  console.log("Verified authenticated portfolio, filters, Maya exclusion and John’s 13 ledger entries over HTTP.");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
