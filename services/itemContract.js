const Joi = require('joi');
class ItemError extends Error {
  constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; }
}
const text = max => Joi.string().trim().max(max).allow('', null);
const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((v, h) => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : h.error('any.invalid');
}).allow(null, '');
const amount = Joi.object({ amount: Joi.number().min(0).max(1e10).required(), currency: Joi.string().pattern(/^[A-Z]{3}$/).required(), date: date.invalid(null, '').required(), source: Joi.string().trim().min(1).max(1000).required() });
const identity = Joi.object({ brand: text(120), model: text(180), serial: text(180), source: text(2000), method: Joi.string().valid('manual', 'photo', 'text', 'document', 'code', 'online').required() });
const record = Joi.object({
  name: Joi.string().trim().min(1).max(180).required(),
  category: Joi.string().valid('appliance', 'device', 'system', 'other').required(), room: text(120),
  identity: identity.required(),
  purchase: Joi.object({ date, retailer: text(180), price: amount.allow(null) }),
  warranty: Joi.object({ provider: text(180), startDate: date, endDate: date, terms: text(4000), claimRoute: text(1000), source: text(2000) }).custom((v,h) => v.startDate && v.endDate && v.endDate < v.startDate ? h.error('any.invalid') : v),
  values: Joi.object({ current: amount.allow(null), replacement: amount.allow(null) }),
  history: Joi.array().max(200).items(Joi.object({ date: date.invalid(null, '').required(), type: Joi.string().valid('installation','service','repair','care').required(), description: Joi.string().trim().min(1).max(2000).required(), provider: text(180), cost: amount.allow(null), nextDate: date })),
  notes: text(4000),
});
function validate(schema, value) {
  const result = schema.validate(value, { abortEarly: true, convert: false });
  if (result.error) throw new ItemError(result.error.details[0].message);
  return result.value;
}
function id(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new ItemError('Invalid identifier');
  return Number(value);
}
const readLevels = new Set(['read','contribute','manage','admin']);
const writeLevels = new Set(['manage','admin']);
module.exports = { ItemError, record, identity, validate, id, readLevels, writeLevels };
