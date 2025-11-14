// src/services/mailService.ts
import logger from '../utils/logger';
import { Resend } from 'resend';
import * as Sentry from "@sentry/node";

const resend = new Resend(process.env.RESEND_API_KEY);

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

const mailService = {
  sendEmail: async (options: MailOptions) => {
    try {
      const mailToSend = {
        from: options.from || process.env.MAIL_FROM || "Gruppy <noreply@gruppy.store>",
        to: options.to,
        subject: options.subject,
        html: options.html,
      };

      const response = await resend.emails.send(mailToSend);

      logger.info(`📧 Email sent via Resend: ${response.id || 'OK'}`);
      return response;

    } catch (error: any) {
      logger.error("❌ Email sending failed:", error);
      Sentry.captureException(error, { extra: { mailOptions: options } });
      throw new Error("Failed to send email via Resend: " + error.message);
    }
  }
};

export default mailService;
