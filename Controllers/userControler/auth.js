const { User } = require("../../models/index");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs"); // Changed from bcrypt to bcryptjs
const emailService = require('../../services/emailService');
const env = require('./../../config/env');

const register = async (req, res) => {
  try {
    const { email, password, first_name, last_name, home_address } = req.body;
    
    // Note: confirmPassword is validated by Joi but not needed in controller

    // Create new user with hashed password
    const user = await User.create({
      email,
      password: password,
      first_name: first_name || null,
      last_name: last_name || null,
      home_address: home_address || null
    });

    // Get user data without password for response
    const userData = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
      home_address: user.home_address,
      created_at: user.created_at
    };

    // Send welcome email to the user
    try {
      const userName = user.first_name 
        ? (user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name)
        : 'User';
      
      await emailService.sendWelcomeEmail(user.email, userName);
      console.log(`Welcome email sent to ${user.email}`);
    } catch (emailError) {
      // Log error but don't fail registration if email fails
      console.error('Failed to send welcome email:', emailError);
    }
   
    // Return success response
    return res.status(201).json({
      message: "User registered successfully",
      success: true,
      data: {
        user: userData
      }
    });

  } catch (error) {
    console.error("Registration error:", error);
    
  

    return res.status(500).json({
      error: "Server error",
      details: env.nodeEnv === 'development' ? error.message : 'Internal server error'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, remember_me } = req.body;

    const user = await User.findOne({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    // Generate JWT token with appropriate expiration
    const tokenExpiration = remember_me === true ? "30d" : "7d";
    
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      env.jwtSecret,
      { expiresIn: tokenExpiration }
    );

    // Get user data without password
    const userData = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
      home_address: user.home_address,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    // Return success response
    return res.status(200).json({
      message: "Login successful",
      success: true,
      data: {
        user: userData,
        token: token,
        expires_in: tokenExpiration
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      error: "Server error",
      details: env.nodeEnv === 'development' ? error.message : 'Internal server error'
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { first_name, last_name, home_address } = req.body;
    const userId = req.user.id; // Assuming you have authentication middleware that sets req.user

    // Find the user
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    // Prepare update data - only include fields that are provided
    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (home_address !== undefined) updateData.home_address = home_address;
    
    // Add updated_at timestamp
    // updateData.updated_at = new Date();

    // Update the user
    await user.update(updateData);

    // Get updated user data without password
    const userData = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
      home_address: user.home_address,
      created_at: user.created_at,
      // updated_at: user.updated_at
    };

    return res.status(200).json({
      message: "User updated successfully",
      success: true,
      data: {
        user: userData
      }
    });

  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({
      error: "Server error",
      details: env.nodeEnv === 'development' ? error.message : 'Internal server error'
    });
  }
};


const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;
    const userId = req.user.id; // Assuming you have authentication middleware that sets req.user

    // Validate required fields
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        error: "Old password, new password, and confirm new password are required",
        success: false
      });
    }

    // Check if new password matches confirmation
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        error: "New password and confirm password do not match",
        success: false
      });
    }

    // Check if new password is different from old password
    if (oldPassword === newPassword) {
      return res.status(400).json({
        error: "New password must be different from the old password",
        success: false
      });
    }

    // Find the user
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        success: false
      });
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    
    if (!isOldPasswordValid) {
      return res.status(400).json({
        error: "Current password is incorrect",
        success: false
      });
    }

    // Update the password (will be hashed by the beforeSave hook in your User model)
    await user.update({
      password: newPassword,
      updated_at: new Date()
    });

    console.log(`Password changed successfully for user: ${user.email}`);

    return res.status(200).json({
      message: "Password changed successfully",
      success: true
    });

  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      error: "Server error",
      success: false,
      details: env.nodeEnv === 'development' ? error.message : 'Internal server error'
    });
  }
};
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Please provide a valid email address",
        success: false
      });
    }

    // Find user by email
    const user = await User.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Security best practice: Don't reveal if email exists
      return res.status(200).json({
        message: "If an account with that email exists, we've sent a password reset link",
        success: true
      });
    }

    // Generate reset token (expires in 1 hour)
    const resetToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        type: 'password_reset'
      },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(
        user.email, 
        resetToken, 
        user.name || user.firstName || 'User'
      );
      
      console.log(`Password reset requested for user: ${user.email}`);
      
      return res.status(200).json({
        message: "If an account with that email exists, we've sent a password reset link",
        success: true
      });
      
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
      
      return res.status(500).json({
        message: "Failed to send reset email. Please try again later.",
        success: false
      });
    }

  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      message: "Server error occurred",
      success: false,
      ...(env.nodeEnv === 'development' && { details: error.message })
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: "Token and new password are required"
      });
    }

    // Verify and decode the reset token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        error: "Invalid or expired reset token"
      });
    }

    // Check if token is for password reset
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        error: "Invalid token type"
      });
    }

    // Find the user
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    // Update the password (will be hashed by the beforeSave hook)
    await user.update({
      password: newPassword,
      updated_at: new Date()
    });

    return res.status(200).json({
      message: "Password reset successfully",
      success: true
    });

  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      error: "Server error",
      details: env.nodeEnv === 'development' ? error.message : 'Internal server error'
    });
  }
};
async function validateToken(token) {
  try {
    const res = await fetch("https://your-api.com/api/auth/validate", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return data.user; // return user if needed
    }

    return false;
  } catch (e) {
    console.error("Token validation failed", e);
    return false;
  }
}
const adminLogin = async (req, res) => {
  try {
    const { email, password, remember_me } = req.body;

    const user = await User.findOne({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    // Check if user is an admin
    if (user.role !== 'admin') {
      return res.status(403).json({
        error: "Access denied. Admin privileges required."
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    // Generate JWT token with appropriate expiration
    const tokenExpiration = remember_me === true ? "30d" : "7d";
    
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      env.jwtSecret,
      { expiresIn: tokenExpiration }
    );

    // Get user data without password
    const userData = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
      home_address: user.home_address,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    // Return success response
    return res.status(200).json({
      message: "Admin login successful",
      success: true,
      data: {
        user: userData,
        token: token,
        expires_in: tokenExpiration
      }
    });

  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      error: "Server error",
      details: env.nodeEnv === 'development' ? error.message : 'Internal server error'
    });
  }
};

const extensionLogin = async (req, res) => {
  try {
    const redirectUri = req.query.redirect_uri;
    if (!redirectUri) {
      return res.status(400).send("Missing redirect_uri");
    }

    // Check if user is logged in via session (if using express-session) or any custom check
    const sessionUser = req.session?.user; // Assumes you're storing user in session

    if (sessionUser) {
      // If logged in, generate token and redirect
      const token = jwt.sign(
        {
          id: sessionUser.id,
          email: sessionUser.email,
          role: sessionUser.role,
        },
        env.jwtSecret,
        { expiresIn: "7d" }
      );

      return res.redirect(`${redirectUri}#access_token=${token}`);
    }

    // If not logged in, redirect to frontend login page with redirect_uri
    const loginPageUrl = `${env.frontEndUrl}/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
    return res.redirect(loginPageUrl);

  } catch (error) {
    console.error("Extension login failed:", error);
    return res.status(500).send("Server error");
  }
};




module.exports = {
  register,
  login,
  adminLogin,
  updateUser,
  forgotPassword,
  resetPassword,
  changePassword,
  extensionLogin
};