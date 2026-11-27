const { ItemError } = require('./itemContract');

function modelKey(identity) {
  const model = String(identity.model || '').trim().toUpperCase();
  return String(identity.brand || '').trim().toLowerCase() === 'bosch' && /^[A-Z0-9]{3,32}$/.test(model) ? model : null;
}

function registeredLink(record) {
  const model = modelKey(record.identity);
  const link = record.manufacturerManualLink;
  return model && link?.brand === 'Bosch' && link.model === model ? link : null;
}

// Bosch embeds its product catalogue in Next.js hydration records. Read the
// JSON data, never execute scripts or borrow links from recommended products.
function operatingManualUrl(html, model) {
  const chunks = [];
  for (const match of html.matchAll(/<script>self\.__next_f\.push\((\[.*?\])\)<\/script>/gs)) {
    try {
      const [kind, value] = JSON.parse(match[1]);
      if (kind === 1 && typeof value === 'string') chunks.push(value);
    } catch { /* An unrelated script is not product evidence. */ }
  }
  const candidates = new Set();
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    if (value.productCode === model && Array.isArray(value.technicalDocuments)) {
      for (const doc of value.technicalDocuments) {
        if (doc?.titleKey === 'user-manuals' && doc.type === 'IU' && doc.locale === 'en-GB' &&
            /^https:\/\/media3\.bsh-group\.com\/Documents\/[a-z\d_-]+\.pdf$/i.test(doc.url)) candidates.add(doc.url);
      }
    }
    Object.values(value).forEach(inspect);
  }
  for (const line of chunks.join('').split('\n')) {
    let data;
    try { data = JSON.parse(line.slice(line.indexOf(':') + 1)); } catch { continue; }
    inspect(data);
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

async function resolveManual(identity, request = fetch) {
  const model = modelKey(identity);
  if (!model) return null;
  const sourceUrl = 'https://www.bosch-home.co.uk/en/product/' + model;
  const options = { redirect: 'error', signal: AbortSignal.timeout(15000) };
  try {
    const page = await request(sourceUrl, options);
    if (page.status === 404) { await page.body?.cancel(); return null; }
    if (!page.ok) { await page.body?.cancel(); throw Error(); }
    const chunks = [];
    let size = 0;
    for await (const chunk of page.body) {
      size += chunk.length;
      if (size > 3 * 1024 * 1024) throw Error();
      chunks.push(chunk);
    }
    const manualUrl = operatingManualUrl(Buffer.concat(chunks).toString('utf8'), model);
    if (!manualUrl) return null;
    const pdf = await request(manualUrl, { ...options, headers: { Range: 'bytes=0-4' } });
    // Some CDNs ignore Range. Stop reading as soon as the PDF signature arrives.
    let prefix = '';
    for await (const chunk of pdf.body) {
      prefix += Buffer.from(chunk.subarray(0, 5 - prefix.length)).toString('latin1');
      if (prefix.length === 5) break;
    }
    if (![200, 206].includes(pdf.status) || prefix !== '%PDF-') return null;
    return { brand: 'Bosch', model, sourceUrl, manualUrl };
  } catch {
    throw new ItemError('The manufacturer could not be checked. Try again later.', 502);
  }
}

module.exports = { registeredLink, resolveManual, operatingManualUrl };
