// src/services/mailService.ts
import logger from '../utils/logger';

/**
 * SIMULATES sending an email. In a real app, this would use
 * a service like SendGrid, Mailgun, or Nodemailer.
 */
const mailService = {
  sendEmail: (options: { to: string; subject: string; text: string; }) => {
    logger.info("====================================");
    logger.info(`📧 SIMULATING EMAIL TO: ${options.to}`);
    logger.info(`SUBJECT: ${options.subject}`);
    logger.info(`BODY: ${options.text}`);
    logger.info("====================================");
    
    // Return a promise to match a real async email service
    return Promise.resolve();
  },
};

export default mailService; // ✅ FIX: Use default export