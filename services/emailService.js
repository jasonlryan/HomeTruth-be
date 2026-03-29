const { createSendGridTransporter } = require('../config/emailConfig');
const env = require('./../config/env');

class EmailService {
  constructor() {
    this.sgMail = null;
  }

  // Initialize SendGrid (lazy loading)
  getSendGridMailer() {
    if (!this.sgMail) {
      this.sgMail = createSendGridTransporter();
    }
    return this.sgMail;
  }

  // Send password reset email
  async sendPasswordResetEmail(email, resetToken, userName = 'User') {
    const mailer = this.getSendGridMailer();
    
    const resetUrl = `${env.frontEndUrl || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const fromEmail = env.sendgrid.fromEmail || env.gmail?.gmailUser || 'noreply@example.com';
    
    const msg = {
      to: email,
      from: {
        email: fromEmail,
        name: env.appName || 'Your App'
      },
      subject: 'Password Reset Request',
      html: this.getPasswordResetHTML(userName, resetUrl),
      text: this.getPasswordResetText(userName, resetUrl)
    };

    try {
      const [response] = await mailer.send(msg);
      console.log(`Password reset email sent to ${email}:`, response.statusCode);
      return { 
        success: true, 
        messageId: response.headers['x-message-id'],
        email: email 
      };
    } catch (error) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response ? {
          statusCode: error.response.statusCode,
          body: error.response.body
        } : null
      };
      console.error('Error sending password reset email:', JSON.stringify(errorDetails, null, 2));
      console.error('From email being used:', fromEmail);
      
      if (error.code === 403) {
        throw new Error(`SendGrid 403 Forbidden: The sender email "${fromEmail}" is not verified in SendGrid. Please verify this email address in your SendGrid account.`);
      } else if (error.code === 401) {
        throw new Error(`SendGrid 401 Unauthorized: Invalid API key. Please check your SENDGRID_API_KEY in the .env file.`);
      } else {
        throw new Error(`Failed to send password reset email: ${error.message}`);
      }
    }
  }

  // Send welcome email
  async sendWelcomeEmail(email, userName) {
    const mailer = this.getSendGridMailer();
    
    const fromEmail = env.sendgrid.fromEmail || env.gmail?.gmailUser || 'noreply@example.com';
    
    const msg = {
      to: email,
      from: {
        email: fromEmail,
        name: env.appName || 'Your App'
      },
      subject: 'Welcome to Our Platform!',
      html: this.getWelcomeHTML(userName),
      text: this.getWelcomeText(userName)
    };

    try {
      const [response] = await mailer.send(msg);
      console.log(`Welcome email sent to ${email}:`, response.statusCode);
      return { 
        success: true, 
        messageId: response.headers['x-message-id'],
        email: email 
      };
    } catch (error) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response ? {
          statusCode: error.response.statusCode,
          body: error.response.body
        } : null
      };
      console.error('Error sending welcome email:', JSON.stringify(errorDetails, null, 2));
      console.error('From email being used:', fromEmail);
      
      if (error.code === 403) {
        throw new Error(`SendGrid 403 Forbidden: The sender email "${fromEmail}" is not verified in SendGrid. Please verify this email address in your SendGrid account.`);
      } else if (error.code === 401) {
        throw new Error(`SendGrid 401 Unauthorized: Invalid API key. Please check your SENDGRID_API_KEY in the .env file.`);
      } else {
        throw new Error(`Failed to send welcome email: ${error.message}`);
      }
    }
  }

  // Send generic email
  async sendEmail({ to, subject, html, text, attachments = [] }) {
    const mailer = this.getSendGridMailer();
    
    const msg = {
      to,
      from: {
        email: env.sendgrid.fromEmail || env.gmail?.gmailUser || 'noreply@example.com',
        name: env.appName || 'Your App'
      },
      subject,
      html,
      text,
      attachments
    };

    try {
      const [response] = await mailer.send(msg);
      console.log(`Email sent to ${to}:`, response.statusCode);
      return { 
        success: true, 
        messageId: response.headers['x-message-id'],
        email: to 
      };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  // HTML template for password reset
  getPasswordResetHTML(userName, resetUrl) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${ env.appName || 'Your App'}</h1>
        </div>
        
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${userName},</p>
        <p>We received a request to reset your password. If this was you, click the button below to reset your password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;
                    font-weight: bold;">
            Reset Password
          </a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #007bff; background: #f8f9fa; padding: 10px; border-radius: 4px;">${resetUrl}</p>
        
        <div style="margin-top: 30px; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
          <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>⚠️ Security Notice:</strong><br>
            • This link will expire in 1 hour<br>
            • If you didn't request this reset, please ignore this email<br>
            • Your password will remain unchanged until you create a new one
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
          <p>This email was sent from ${ env.appName || 'Your App'}</p>
          <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>
        </div>
      </div>
    `;
  }

  // Text template for password reset
  getPasswordResetText(userName, resetUrl) {
    return `
Password Reset Request

Hello ${userName},

We received a request to reset your password. If this was you, visit the following link to reset your password:

${resetUrl}

Security Notice:
- This link will expire in 1 hour
- If you didn't request this reset, please ignore this email
- Your password will remain unchanged until you create a new one

---
${ env.appName || 'Your App'}
    `.trim();
  }

  // HTML template for welcome email
  getWelcomeHTML(userName) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${ env.appName || 'Your App'}</h1>
        </div>
        
        <h2 style="color: #28a745;">Welcome to our platform!</h2>
        <p>Hello ${userName},</p>
        <p>Thank you for joining us! We're excited to have you on board.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${env.frontEndUrl || 'http://localhost:3000'}/dashboard" 
             style="background-color: #28a745; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;
                    font-weight: bold;">
            Get Started
          </a>
        </div>
        
        <p>If you have any questions, feel free to reach out to our support team.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
          <p>Welcome aboard!</p>
          <p>${ env.appName || 'Your App'} Team</p>
        </div>
      </div>
    `;
  }

  // Text template for welcome email
  getWelcomeText(userName) {
    return `
Welcome to ${ env.appName || 'Your App'}!

Hello ${userName},

Thank you for joining us! We're excited to have you on board.

Get started: ${env.frontEndUrl || 'http://localhost:3000'}/dashboard

If you have any questions, feel free to reach out to our support team.

Welcome aboard!
${ env.appName || 'Your App'} Team
    `.trim();
  }

  // Send waitlist confirmation email
  async sendWaitlistConfirmationEmail(email) {
    const mailer = this.getSendGridMailer();
    
    const fromEmail = env.sendgrid.fromEmail || env.gmail?.gmailUser || 'noreply@example.com';
    
    const msg = {
      to: email,
      from: {
        email: fromEmail,
        name: env.appName || 'HomeTruth'
      },
      subject: 'You\'re on the HomeTruth Waitlist! 🎉',
      html: this.getWaitlistConfirmationHTML(),
      text: this.getWaitlistConfirmationText()
    };

    try {
      const [response] = await mailer.send(msg);
      console.log(`Waitlist confirmation email sent to ${email}:`, response.statusCode);
      return { 
        success: true, 
        messageId: response.headers['x-message-id'],
        email: email 
      };
    } catch (error) {
      // Enhanced error logging for SendGrid
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response ? {
          statusCode: error.response.statusCode,
          body: error.response.body,
          headers: error.response.headers
        } : null
      };
      
      console.error('Error sending waitlist confirmation email:', JSON.stringify(errorDetails, null, 2));
      console.error('From email being used:', fromEmail);
      
      // Provide more helpful error messages
      if (error.code === 403) {
        throw new Error(`SendGrid 403 Forbidden: The sender email "${fromEmail}" is not verified in SendGrid. Please verify this email address in your SendGrid account.`);
      } else if (error.code === 401) {
        throw new Error(`SendGrid 401 Unauthorized: Invalid API key. Please check your SENDGRID_API_KEY in the .env file.`);
      } else {
        throw new Error(`Failed to send waitlist confirmation email: ${error.message}`);
      }
    }
  }

  // HTML template for waitlist confirmation
  getWaitlistConfirmationHTML() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${env.appName || 'HomeTruth'}</h1>
        </div>
        
        <h2 style="color: #28a745; text-align: center;">🎉 You're on the Waitlist!</h2>
        <p>Thank you for joining the HomeTruth waitlist!</p>
        <p>We're thrilled to have you with us. You'll be among the first to know when we launch and get early access to all our amazing features.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
          <h3 style="color: #333; margin-top: 0;">What's Next?</h3>
          <ul style="color: #555; line-height: 1.8;">
            <li>We'll keep you updated on our progress</li>
            <li>You'll receive early access when we launch</li>
            <li>Get exclusive updates and tips</li>
          </ul>
        </div>
        
        <p style="text-align: center; margin: 30px 0;">
          <strong>We'll be in touch soon!</strong>
        </p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
          <p>No spam, ever. We'll be in touch with updates.</p>
          <p>${env.appName || 'HomeTruth'} Team</p>
        </div>
      </div>
    `;
  }

  // Text template for waitlist confirmation
  getWaitlistConfirmationText() {
    return `
You're on the Waitlist! 🎉

Thank you for joining the HomeTruth waitlist!

We're thrilled to have you with us. You'll be among the first to know when we launch and get early access to all our amazing features.

What's Next?
- We'll keep you updated on our progress
- You'll receive early access when we launch
- Get exclusive updates and tips

We'll be in touch soon!

---
No spam, ever. We'll be in touch with updates.

${env.appName || 'HomeTruth'} Team
    `.trim();
  }
}

// Export singleton instance
module.exports = new EmailService();