const defaults = ['http://localhost:3000', 'http://localhost:8007', 'https://b8299deae6d9.ngrok-free.app', 'https://hometruth.ohtplayground.com', 'http://3.141.227.135:8007', 'https://hometruth.io'];
module.exports = function allowedOrigin(origin, {
  nodeEnv,
  frontEndUrl
}) {
  if (!origin) return true;
  if (defaults.includes(origin) || origin === frontEndUrl?.replace(/\/$/, '')) return true;
  return nodeEnv !== 'production' && /^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}$/.test(origin);
};
