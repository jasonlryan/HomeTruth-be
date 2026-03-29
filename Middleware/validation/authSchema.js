const Joi = require("joi");
const { validateSchema } = require("../validation");
const { User } = require("../../models/index");

const userRegistrationSchema = Joi.object({
  email: Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase() // <-- automatically converts input to lowercase
  .pattern(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/)
  .required()
  .messages({
    "string.empty": "Email is required",
    "string.email": "Email must be a valid email address",
    "string.pattern.base":
      "Email must be lowercase, and must not contain capital letters or emojis",
  }),

  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters",
  }),

  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "string.empty": "Confirm password is required",
    "any.only": "Passwords do not match",
  }),

  first_name: Joi.string().min(2).max(100).optional().messages({
    "string.min": "First name must be at least 2 characters",
    "string.max": "First name must not exceed 100 characters",
  }),

  last_name: Joi.string().min(2).max(100).optional().messages({
    "string.min": "Last name must be at least 2 characters",
    "string.max": "Last name must not exceed 100 characters",
  }),

  home_address: Joi.string().max(255).optional().messages({
    "string.max": "Home address must not exceed 255 characters",
  }),
});

const checkUserExists = async (req, res, next) => {
  try {
    const { email } = req.body;

    const emailExists = await User.count({ where: { email } });
    if (emailExists) {
      return res.status(400).json({
        message: "Email is already in use",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const loginSchema = Joi.object({
  email: Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase() // <-- automatically converts input to lowercase
  .pattern(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/)
  .required()
  .messages({
    "string.empty": "Email is required",
    "string.email": "Email must be a valid email address",
    "string.pattern.base":
      "Email must be lowercase, and must not contain capital letters or emojis",
  }),

  password: Joi.string().required().messages({
    "string.empty": "Password is required",
  }),

  // Changed from required to optional with default false
  remember_me: Joi.boolean().optional().default(false).messages({
    "boolean.base": "Remember me must be true or false",
  }),
});

const adminLoginSchema = Joi.object({
  email: Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .pattern(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/)
  .required()
  .messages({
    "string.empty": "Email is required",
    "string.email": "Email must be a valid email address",
    "string.pattern.base":
      "Email must be lowercase, and must not contain capital letters or emojis",
  }),

  password: Joi.string().required().messages({
    "string.empty": "Password is required",
  }),

  remember_me: Joi.boolean().optional().default(false).messages({
    "boolean.base": "Remember me must be true or false",
  }),
});
const updateUserSchema = Joi.object({
  first_name: Joi.string().max(100).optional(),
  last_name: Joi.string().max(100).optional(),
  home_address: Joi.string().max(255).optional()
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Please provide a valid email address",
    }),
});

// Reset password schema - consistent with existing patterns
const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    "string.empty": "Reset token is required",
  }),
  
  newPassword: Joi.string()
    .min(6)
    .max(100)
    .required()
    .messages({
      "string.empty": "New password is required",
      "string.min": "Password must be at least 6 characters long",
      "string.max": "Password must not exceed 100 characters",
    }),
});
const normalizeEmailMiddleware = (req, res, next) => {
  if (req.body.email && typeof req.body.email === 'string') {
    req.body.email = req.body.email.toLowerCase();
  }
  next();
};

const authValidation = {
  userRegistrationSchema: validateSchema(userRegistrationSchema),
  checkUserExists,
  normalizeEmailMiddleware,
  loginSchema: validateSchema(loginSchema),
  adminLoginSchema: validateSchema(adminLoginSchema),
  updateUserSchema: validateSchema(updateUserSchema),
  forgotPasswordSchema: validateSchema(forgotPasswordSchema),
  resetPasswordSchema: validateSchema(resetPasswordSchema),
};

module.exports = authValidation;