const express = require("express");
const router = express.Router();
const authController = require("../../Controllers/userControler/auth");
const auth = require("../../Middleware/authMiddleware");
const syncController = require("../../Controllers/extension/syncController");

// Import the validation object (not destructured)
const authValidation = require("../../Middleware/validation/authSchema");

// Registration route
router.post(
  "/register",
  authValidation.normalizeEmailMiddleware,
  authValidation.userRegistrationSchema,
  authValidation.checkUserExists,
  authController.register
);

// Login route
router.post(
  "/login",
  authValidation.normalizeEmailMiddleware,
  authValidation.loginSchema,
  authController.login
);

// Admin login route
router.post(
  "/admin/login",
  authValidation.normalizeEmailMiddleware,
  authValidation.adminLoginSchema,
  authController.adminLogin
);

router.get("/validate", auth, (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
});
// router.post("/sync", auth,syncController.syncUser);


// Update profile route
router.put('/update-profile',
   auth,
  authValidation.updateUserSchema,
  authController.updateUser);

  // Forgot password route
router.post(
  "/forgot-password",
  authValidation.forgotPasswordSchema,
  authController.forgotPassword
);

// Reset password route
router.patch(
  "/reset-password",
  authValidation.resetPasswordSchema,
  authController.resetPassword
);
router.patch(
  "/change-password",
  auth,
  authController.changePassword
);
router.get("/extension-login", authController.extensionLogin);





module.exports = router;