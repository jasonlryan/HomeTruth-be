const { Waitlist } = require('../models/index');
const emailService = require('../services/emailService');
const env = require('../config/env');

const joinWaitlist = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address',
        success: false
      });
    }

    // Normalize email (lowercase)
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists in waitlist
    const existingWaitlist = await Waitlist.findOne({
      where: { email: normalizedEmail }
    });

    if (existingWaitlist) {
      // If already exists, send confirmation email again
      try {
        await emailService.sendWaitlistConfirmationEmail(normalizedEmail);
        return res.status(200).json({
          message: 'You are already on our waitlist! We\'ve sent you a confirmation email.',
          success: true
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        return res.status(200).json({
          message: 'You are already on our waitlist!',
          success: true
        });
      }
    }

    // Create new waitlist entry
    const waitlistEntry = await Waitlist.create({
      email: normalizedEmail,
      status: 'pending'
    });

    // Send confirmation email
    try {
      await emailService.sendWaitlistConfirmationEmail(normalizedEmail);
      console.log(`Waitlist confirmation email sent to ${normalizedEmail}`);
    } catch (emailError) {
      // Log error but don't fail the request
      console.error('Failed to send waitlist confirmation email:', emailError);
    }

    return res.status(201).json({
      message: 'Thank you for joining our waitlist! We\'ve sent you a confirmation email.',
      success: true,
      data: {
        email: waitlistEntry.email,
        joined_at: waitlistEntry.joined_at
      }
    });

  } catch (error) {
    console.error('Join waitlist error:', error);
    return res.status(500).json({
      message: 'Server error occurred',
      success: false,
      ...(env.nodeEnv === 'development' && { details: error.message })
    });
  }
};

module.exports = {
  joinWaitlist
};

