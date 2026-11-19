// Official UK entry points verified 2026-10-29. No scraping or implied retrieved manual.
const finders = {
  bosch: 'https://www.bosch-home.co.uk/customer-service/instruction-manuals',
  beko: 'https://www.beko.co.uk/support/manuals',
  samsung: 'https://www.samsung.com/uk/support/user-manuals-and-guide/'
};
module.exports = (brand, model) => {
  const url = finders[String(brand).trim().toLowerCase()];
  return {
    brand,
    model,
    officialFinder: url || null,
    manualLibrarySearch: `https://www.google.com/search?q=${encodeURIComponent(`site:manualslib.com ${brand} ${model} manual`)}`,
    searchLink: `https://www.google.com/search?q=${encodeURIComponent(`${brand} ${model} official manufacturer manual`)}`,
    notice: 'The model is retained here. Open the official finder, check the complete variant, then attach the downloaded manual. Linked pages have not been retrieved or read by AskAI.'
  };
};
