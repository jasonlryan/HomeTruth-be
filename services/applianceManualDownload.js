const https = require('https');
const dns = require('dns').promises;
const net = require('net');
const { officialURL, containsModel } = require('./applianceManualPolicy');
const { ItemError } = require('./itemContract');
const MAX_BYTES = 5 * 1024 * 1024;
function publicAddress(address) {
  // Deliberately use public IPv4 only; reject local, link-local, reserved and multicast ranges.
  if (net.isIP(address) !== 4) return false;
  const [a,b] = address.split('.').map(Number);
  return !(a===0 || a===10 || a===127 || a>=224 || a===169&&b===254 || a===172&&b>=16&&b<=31 || a===192&&(b===168||b===0) || a===100&&b>=64&&b<=127 || a===198&&(b===18||b===19));
}
async function download(url, domains, redirects = 0, deadline = Date.now()+45000) {
  if (Date.now()>=deadline || !officialURL(url, domains) || redirects > 3) throw new ItemError('This manual cannot be imported automatically. Use the official finder or upload the file.');
  const addresses = await dns.lookup(new URL(url).hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new ItemError('The manual address is not an allowed public source.');
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 15000, signal: AbortSignal.timeout(Math.max(1,deadline-Date.now())), lookup: (_host, options, cb) => options.all ? cb(null, [addresses[0]]) : cb(null, addresses[0].address, 4), headers: { 'User-Agent': 'HomeTruth/1.0 (user-requested appliance manual)', Accept: 'application/pdf' } }, response => {
      if ([301,302,303,307,308].includes(response.statusCode)) {
        response.resume();
        let next; try { next = new URL(response.headers.location, url).href; } catch { return reject(new ItemError('Invalid manual redirect.')); }
        return download(next, domains, redirects+1, deadline).then(resolve,reject);
      }
      if (response.statusCode !== 200 || Number(response.headers['content-length'] || 0) > MAX_BYTES) { response.resume(); return reject(new ItemError('The manufacturer did not return a PDF under 5 MB.')); }
      let size=0; const chunks=[];
      response.on('data', chunk => { size += chunk.length; if(size>MAX_BYTES) response.destroy(new ItemError('The manual is over 5 MB. Download it from the manufacturer and upload it here.')); else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => {
        const buffer=Buffer.concat(chunks);
        if(buffer.subarray(0,5).toString()!=='%PDF-') return reject(new ItemError('This link is a web page, not a downloadable PDF. Open it to find the manual.'));
        resolve({buffer, sourceUrl:url});
      });
    });
    request.on('timeout', () => request.destroy(new ItemError('The manufacturer took too long. Your item is unchanged.')));
    request.on('error', reject);
  });
}
async function extractAndCheck(buffer, model) {
  const text = (await require('pdf-parse')(Uint8Array.from(buffer))).text;
  if (!text?.trim() || text.length > 750000 || !containsModel(text, model)) throw new ItemError('The complete model could not be verified inside this PDF. Open it and check, then upload it if appropriate.');
  return text;
}
module.exports = { download, extractAndCheck, publicAddress };
