import logger from "../utils/logger";
import { Resend } from "resend";
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
      const response = await resend.emails.send({
        from: options.from || process.env.MAIL_FROM || "Gruppy <noreply@gruppy.store>",
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      logger.info(`📧 Resend: Email sent → ${response.data?.id ?? "no-id-returned"}`);

      return response;

    } catch (error: any) {
      logger.error("❌ Failed to send email via Resend:", error);
      Sentry.captureException(error, { extra: { mailOptions: options } });
      throw new Error("Email sending failed: " + error.message);
    }
  },
};

export default mailService;
