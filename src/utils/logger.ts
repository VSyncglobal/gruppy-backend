import winston from "winston";

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom format for development logs to make them more readable
const devLogFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format:
    process.env.NODE_ENV === "production"
      ? combine(timestamp(), json()) // Use JSON format in production
      : combine(
          colorize(),
          timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
        ),
  transports: [
    // In production, we would also add transports to write to files or a logging service
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console(),
  ],
});

export default logger;