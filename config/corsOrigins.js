const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000'];
module.exports = function allowedOrigin(origin, {
  nodeEnv
}) {
  if (!origin) return true;
  if (defaults.includes(origin)) return true;
  return nodeEnv !== 'production' && /^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}$/.test(origin);
};
