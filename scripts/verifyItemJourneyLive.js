// Real local app, MySQL/Qdrant and configured AI, using a disposable synthetic account only.
const fs = require('fs'),
  assert = require('node:assert/strict'),
  crypto = require('crypto');
require('dotenv').config({
  path: require('path').resolve(__dirname, '../../HomeTruth_BE-staging/.env')
});
process.env.AUTO_SYNC_DB = 'false';
const User = require('../models/User'),
  Property = require('../models/property'),
  db = require('../config/database');
const base = 'http://127.0.0.1:8006';
async function main() {
  if (process.env.HT341_LIVE_LOCAL_VERIFY !== 'true' || !['localhost', '127.0.0.1'].includes(process.env.DB_HOST)) throw new Error('Explicit local verification flag required.');
  const email = `ht341-${Date.now()}@example.invalid`,
    password = crypto.randomBytes(24).toString('hex');
  let user,
    home,
    token,
    documentId,
    passed = false;
  const call = async (path, method = 'GET', payload, raw = false) => {
    const headers = token ? {
      Authorization: token
    } : {};
    if (payload && !raw) headers['Content-Type'] = 'application/json';
    const result = await fetch(base + path, {
      method,
      headers,
      body: payload ? raw ? payload : JSON.stringify(payload) : undefined
    });
    const body = await result.json();
    if (!result.ok) throw new Error(`${method} ${path}: ${result.status} ${body.message || body.error}`);
    return body.data;
  };
  try {
    user = await User.create({
      first_name: 'Synthetic',
      last_name: 'HT341 review',
      email,
      password,
      role: 'user',
      is_verified: true
    });
    const login = await call('/api/auth/login', 'POST', {
      email,
      password
    });
    token = login.token;
    const profile = await call('/api/property-records', 'POST', {
      relationshipType: 'owner',
      propertyType: 'house',
      tenure: 'freehold',
      address: {
        addressLine1: 'Synthetic HT341 test home',
        postcode: 'ZZ1 1ZZ'
      }
    });
    home = profile.property.id;
    const form = new FormData();
    form.append('documents', new Blob([fs.readFileSync(require('path').join(__dirname,'fixtures/ht341/synthetic-manual.pdf'))], {
      type: 'application/pdf'
    }), 'synthetic-test-manual.pdf');
    form.append('propertyId', String(home));
    const uploaded = await call('/api/user-documents/upload', 'POST', form, true);
    assert.ok(uploaded.documents.length, JSON.stringify(uploaded.results));
    documentId = uploaded.documents[0].id;
    const intake = new FormData();
    intake.append('method', 'document');
    intake.append('documentId', String(documentId));
    const identified = await call(`/api/property-records/${home}/items/identify`, 'POST', intake, true);
    const candidate = identified.candidates.find(c => c.model === 'WAN282X2GB');
    assert.ok(candidate, 'Exact source model was not established');
    const item = await call(`/api/property-records/${home}/items`, 'POST', {
      requestKey: crypto.randomUUID(),
      record: {
        name: 'Synthetic washer',
        category: 'appliance',
        identity: {
          brand: candidate.brand,
          model: candidate.model,
          method: 'document',
          source: candidate.quote
        },
        purchase: candidate.purchase,
        warranty: candidate.warranty,
        values: {},
        history: []
      }
    });
    const linked = await call(`/api/property-records/${home}/items/${item.id}/evidence`, 'POST', {
      documentId,
      role: 'manual',
      matchStatus: 'user_confirmed'
    });
    const evidenceId = linked.evidence[0].id;
    const answer = await call(`/api/property-records/${home}/items/${item.id}/ask`, 'POST', {
      question: 'Which programme should I use for cotton?',
      evidenceIds: [evidenceId]
    });
    assert.ok(answer.statements.length);
    assert.ok(answer.saveToken);
    await call(`/api/property-records/${home}/items/${item.id}/answers`, 'POST', {
      token: answer.saveToken
    });
    const saved = await call(`/api/property-records/${home}/items/${item.id}/answers`);
    assert.equal(saved.length, 1);
    assert.ok(saved[0].answer.statements.length);
    const preview = await call(`/api/user-documents/${documentId}/preview`);
    assert.ok(preview.preview_content || preview.preview_image);
    const again = await call(`/api/property-records/${home}/items/${item.id}`);
    assert.equal(again.record.identity.model, 'WAN282X2GB');
    if(process.argv.includes('--keep')) fs.writeFileSync('/tmp/ht341-live-context.json', JSON.stringify({
      token,
      email,
      password,
      userId: user.id,
      homeId: home,
      itemId: item.id,
      documentId
    }), {
      mode: 0o600
    });
    passed = true;
    console.log(JSON.stringify({
      passed: true,
      realApp: true,
      realDocumentIngestion: true,
      realAI: true,
      realQdrant: true,
      persistentSavedAnswer: true,
      directPreview: true,
      model: again.record.identity.model,
      customerDataUsed: false,
      fixtureRetainedForBrowser: process.argv.includes('--keep')
    }));
  } finally {
    if (!passed || !process.argv.includes('--keep')) {
      if (documentId && token) await call(`/api/user-documents/${documentId}`, 'DELETE').catch(() => {});
      if (home) await Property.destroy({
        where: {
          id: home
        }
      });
      if (user) await user.destroy();
    }
    await db.close();
  }
}
main().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
