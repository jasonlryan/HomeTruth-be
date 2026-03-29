const rateLimit = require("express-rate-limit");

// Anonymous chat: soft IP limit; 5 messages per session enforced in controller
const anonymousChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || "unknown",
  message: {
    success: false,
    error: "Too many anonymous chat requests. Please try again later.",
    retryAfter: "1 hour"
  }
});

// Optional: Different rate limiter for general API endpoints
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Optional: Stricter rate limiter for authenticated users (to prevent abuse)
const authenticatedChatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Authenticated users get more requests
  message: {
    success: false,
    error: "Too many chat requests, please slow down.",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID for authenticated requests instead of IP
    return req.user?.id?.toString() || req.ip;
  }
});

module.exports = {
  anonymousChatLimiter,
  generalApiLimiter,
  authenticatedChatLimiter
};
