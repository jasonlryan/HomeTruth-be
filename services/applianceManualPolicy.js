const { ItemError } = require('./itemContract');
// Explicit manufacturer scope. Adding another brand requires verifying its official domains.
const manufacturers = {
  bosch: ['bosch-home.co.uk', 'bosch-home.com', 'media3.bsh-group.com'],
  beko: ['beko.co.uk', 'beko.com', 'documents.beko.com'],
  samsung: ['samsung.com', 'downloadcenter.samsung.com'],
  siemens: ['siemens-home.bsh-group.com', 'media3.bsh-group.com'],
  neff: ['neff-home.com', 'media3.bsh-group.com'],
  miele: ['miele.co.uk', 'miele.com'],
  aeg: ['aeg.co.uk', 'electrolux-ui.com'],
  electrolux: ['electrolux.co.uk', 'electrolux-ui.com']
};
const domainsFor = brand => manufacturers[String(brand).trim().toLowerCase()] || [];
function officialURL(value, domains) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443') return null;
    if (!domains.some(d => u.hostname === d || u.hostname.endsWith('.' + d))) return null;
    u.hash = '';
    return u.href;
  } catch { return null; }
}
function containsModel(text, model) {
  // Preserve variant suffixes and token boundaries: W100 is not W100A.
  const escaped = model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(text);
}
// Require an operating-document title near the start of the PDF. Model numbers,
// uploaded filenames and catalogue descriptions also occur on product sheets.
function isOperatingManual(text, model) {
  if (!text || !model) return false;
  const escaped = model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = new RegExp(`(^|[^a-z0-9])${escaped}(?![a-z0-9]|[./-][a-z0-9])`, 'i');
  const cover = text.slice(0, 1500).replace(/\s+/g, ' ');
  const title = /\b(?:user(?:['’]s)?|owner(?:['’]s)?|instruction|operating|use and care) (?:manual|guide|handbook)\b|\b(?:operating instructions|instructions for use|instructions for installation and use)\b/i;
  return exact.test(text) && title.test(cover) && !/\b(?:product (?:data|information|specification) sheet|technical data sheet|spec(?:ification)? sheet|sales leaflet)\b/i.test(cover);
}
function reviewCandidates(raw, brand, model) {
  const domains = domainsFor(brand), seen = new Set();
  const cited = new Set((raw.sourceUrls || []).map(u => officialURL(u, domains)).filter(Boolean));
  return (raw.candidates || []).slice(0, 4).flatMap(c => {
    const url = officialURL(c.url, domains);
    if (/\b(?:spec(?:ification)? sheet|data sheet|product (?:information|data) sheet|sales (?:leaflet|brochure))\b/i.test(c.title || '')) return [];
    if (!url || seen.has(url) || !cited.has(url) || c.model?.toLowerCase() !== model.toLowerCase() || !containsModel(c.quote || '', model)) return [];
    seen.add(url);
    return [{ title: String(c.title).slice(0, 250), url, model, quote: String(c.quote).slice(0, 1200), kind: /\.pdf$/i.test(new URL(url).pathname) ? 'pdf' : 'support_page', matchStatus: 'needs_review' }];
  });
}
function assertSameIdentity(item, snapshot) {
  if (item.record.identity.brand !== snapshot.brand || item.record.identity.model !== snapshot.model) throw new ItemError('The model changed. Run the agent again before using these findings.', 409);
}
module.exports = { manufacturerDomains: [...new Set(Object.values(manufacturers).flat())], domainsFor, officialURL, containsModel, isOperatingManual, reviewCandidates, assertSameIdentity };
