/**
 * Utility functions for email verification
 */

/**
 * Generates a 4-digit verification code
 * @returns {string} 4-digit code
 */
export function generateVerificationCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Checks if a verification code has expired
 * @param {Date|string} expiresAt - Expiration timestamp
 * @returns {boolean} True if expired, false otherwise
 */
export function isCodeExpired(expiresAt) {
  if (!expiresAt) return true;
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  return now > expirationDate;
}

/**
 * Generates expiration date (default: 1 hour from now)
 * @param {number} hours - Number of hours until expiration (default: 1)
 * @returns {Date} Expiration date
 */
export function generateExpirationDate(hours = 1) {
  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + hours);
  return expirationDate;
}

