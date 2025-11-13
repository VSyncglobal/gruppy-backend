// src/services/mailService.ts
import logger from '../utils/logger';
import nodemailer from 'nodemailer';
import * as Sentry from "@sentry/node";

type MailTransporter = nodemailer.Transporter;

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string; // --- NEW (v_final): Allow 'from' override
}

let transporterInstance: MailTransporter | null = null;

const getTransport = async (): Promise<MailTransporter> => {
  if (transporterInstance) {
    return transporterInstance;
  }

  if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
    logger.info('Creating production mail transporter...');
    transporterInstance = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    logger.warn('SMTP_HOST not found. Creating Ethereal test mail account...');
    let testAccount = await nodemailer.createTestAccount();
    logger.info(`📧 Ethereal account created: ${testAccount.user}`);
    
    transporterInstance = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user, // Ethereal username
        pass: testAccount.pass, // Ethereal password
      },
    });
  }

  return transporterInstance;
};

const mailService = {
  sendEmail: async (options: MailOptions) => {
    try {
      const transporter = await getTransport();
      
      // --- MODIFIED (v_final): Use default MAIL_FROM, but allow override ---
      const mailDefaults = {
        from: process.env.MAIL_FROM || 'Gruppy <noreply@gruppy.com>',
      };

      const mailToSend = {
        ...mailDefaults,
        ...options, // This will override 'from' if options.from is provided
      };

      const info = await transporter.sendMail(mailToSend);
      // --- END MODIFICATION ---

      logger.info(`Email sent: ${info.messageId}`);

      if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
        logger.info(`📧 Ethereal Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (error: any) {
      logger.error('Error sending email:', error);
      Sentry.captureException(error, { extra: { mailOptions: options } });
      if (!transporterInstance) {
        throw new Error(`Failed to create mail transport: ${error.message}`);
      }
    }
  },
};

export default mailService;