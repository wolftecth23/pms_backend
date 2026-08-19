import { SourceUser } from '../types/sync.types';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validates a user record fetched from the source database.
 * Rules:
 * - Skip users if id is null/undefined
 * - Skip users if email is null/undefined/empty
 */
export function validateSourceUser(user: SourceUser): ValidationResult {
  if (user.id === null || user.id === undefined) {
    return { isValid: false, reason: 'id is null or undefined' };
  }
  if (!user.email || user.email.trim() === '') {
    return { isValid: false, reason: 'email is null or empty' };
  }
  return { isValid: true };
}
