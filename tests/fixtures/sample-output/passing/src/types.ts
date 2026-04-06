/**
 * Shared type definitions for the user module.
 */

/** A stored user record. */
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

/** Supported user roles. */
export type UserRole = 'admin' | 'editor' | 'viewer';

/** Result of a validation check. */
export interface ValidationResult {
  valid: boolean;
  message: string;
}
