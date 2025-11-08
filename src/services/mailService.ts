// src/services/mailService.ts
import logger from '../utils/logger';
import nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// --- v1.3: Make Mail Service Functional ---

// We will use Nodemailer. By default, it's set to use Ethereal,
// which is a test-only email service.
// Replace this with your real SMTP (SendGrid, Mailgun, etc.) credentials.
const createTransport = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
    // --- PRODUCTION TRANSPORT ---
    // (e.g., SendGrid, Mailgun)
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // --- DEVELOPMENT/TEST TRANSPORT (Ethereal) ---
    // This creates a *temporary* test inbox.
    // Credentials will be logged to the console on first email send.
    logger.warn('SMTP_HOST not found. Using Ethereal test mail service.');
    let testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user, // Ethereal username
        pass: testAccount.pass, // Ethereal password
      },
    });
  }
};

const mailService = {
  sendEmail: async (options: MailOptions) => {
    try {
      const transporter = await createTransport();
      const mailDefaults = {
        from: `Gruppy <${process.env.MAIL_FROM || 'noreply@gruppy.com'}>`,
      };

      const info = await transporter.sendMail({
        ...mailDefaults,
        ...options,
      });

      logger.info(`Email sent: ${info.messageId}`);

      // If using Ethereal, log the preview URL
      if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
        logger.info(`📧 Ethereal Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (error) {
      logger.error('Error sending email:', error);
      // We don't throw, as email failure shouldn't block main logic
    }
  },
};

export default mailService;