// src/utils/token.ts
import crypto from 'crypto';

/**
 * Generates a secure, random 6-digit numeric code.
 */
export const generateNumericCode = (length: number = 6): string => {
  return crypto.randomInt(0, Math.pow(10, length)).toString().padStart(length, '0');
};

/**
 * Generates a secure, random, URL-safe string token.
 */
export const generateVerificationToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Creates a hashed token and its expiration date.
 * @param token The raw token to hash.
 * @returns { hashedToken: string, expiresAt: Date }
 */
export const hashToken = (token: string) => {
  // NOTE: For password resets, we hash the token before saving.
  // This is a security best practice. If the DB is leaked,
  // attackers can't use the raw reset tokens.
  // For this example, we'll just use a simple hash.
  // In production, you'd use bcrypt, but that's slow for tokens.
  // We'll use a fast, secure, non-reversible hash.
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Token expires in 1 hour
  const expiresAt = new Date(Date.now() + 3600 * 1000); 

  return { hashedToken, expiresAt };
};