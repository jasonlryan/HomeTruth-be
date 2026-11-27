const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveManual, operatingManualUrl } = require('../services/manufacturerManualLink');

const model = 'W100';
const identity = { brand: 'Bosch', model };
const url = 'https://media3.bsh-group.com/Documents/1234_A.pdf';
const doc = { titleKey: 'user-manuals', type: 'IU', locale: 'en-GB', url };
function page(products) {
  const data = '2:' + JSON.stringify(products) + '\n';
  return '<script>self.__next_f.push(' + JSON.stringify([1, data]) + ')</script>';
}
const product = (productCode, ...technicalDocuments) => ({ productCode, technicalDocuments });

test('takes the unique English operating-manual link from the exact Bosch product', () => {
  const html = page([product('W100A', { ...doc, url: url.replace('1234', '999') }),
    product(model, { ...doc, titleKey: 'specification-sheet' }, doc)]);
  assert.equal(operatingManualUrl(html, model), url);
  for (const candidate of [{ ...doc, url: 'https://example.com/manual.pdf' }, { ...doc, type: 'II' }, { ...doc, locale: 'de-DE' }]) {
    assert.equal(operatingManualUrl(page(product(model, candidate)), model), null);
  }
  assert.equal(operatingManualUrl(page(product(model, doc, { ...doc, url: url.replace('1234','444') })), model), null);
});

test('verifies PDF signature without importing content or following redirects', async () => {
  const calls = [];
  const request = async (target, options) => {
    calls.push(target);
    assert.equal(options.redirect, 'error');
    if (target === url) {
      assert.equal(options.headers.Range, 'bytes=0-4');
      return new Response('%PDF-', { status: 206 });
    }
    return new Response(page(product(model, doc)));
  };
  const link = await resolveManual(identity, request);
  assert.deepEqual(link, { ...identity, sourceUrl: 'https://www.bosch-home.co.uk/en/product/W100', manualUrl: url });
  assert.deepEqual(calls, [link.sourceUrl, url]);
  assert.equal(await resolveManual(identity, async target => new Response(target === url ? '<html>' : page(product(model, doc)))), null);
  assert.equal(await resolveManual({ ...identity, model: 'W100/01' }, () => assert.fail()), null);
});
