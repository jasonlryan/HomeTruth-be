
require("dotenv").config();
const jwt = require("jsonwebtoken");
const env = require('./../config/env');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, env.jwtSecret);

    req.user = decoded;

    next();
  } catch (error) {
    res
      .status(401)
      .json({ message: "Invalid or expired token", error: error.message });
  }
};


module.exports = authMiddleware;
