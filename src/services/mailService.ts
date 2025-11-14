// src/services/mailService.ts
import { Resend } from 'resend';
import logger from '../utils/logger';
import * as Sentry from '@sentry/node';

const resend = new Resend(process.env.RESEND_API_KEY || '');

export interface MailOptions {
  to: string;
  template: {
    id: string; // Resend template name or ID
    variables?: Record<string, string | number>;
  };
  from?: string;
}

const mailService = {
  sendEmail: async (options: MailOptions) => {
    try {
      const fromAddress = options.from || 'Gruppy <noreply@gruppy.store>';

      const { data, error } = await resend.emails.send({
        to: options.to,
        template: options.template,
        from: fromAddress,
      });

      if (error) {
        logger.error('Error sending email via Resend:', error);
        Sentry.captureException(error, { extra: { mailOptions: options } });
        return;
      }

      logger.info(`Email sent via Resend: ${data?.id}`);
    } catch (err: any) {
      logger.error('MailService unexpected error:', err);
      Sentry.captureException(err, { extra: { mailOptions: options } });
    }
  },
};

export default mailService;
