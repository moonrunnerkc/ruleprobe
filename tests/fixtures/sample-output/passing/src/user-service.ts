/**
 * User service for managing user accounts.
 */

import type { UserRecord } from './types.js';
import { validateEmail } from '../utils/validation.js';

/** Shape of a new user request. */
export interface CreateUserRequest {
  email: string;
  name: string;
  role: string;
}

/** Shape of a user response. */
export interface UserResponse {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

/**
 * Create a new user account.
 *
 * @param request - The user creation request
 * @returns The created user response
 */
export function createUser(request: CreateUserRequest): UserResponse {
  const isValid = validateEmail(request.email);
  if (!isValid) {
    throw new Error(`Invalid email: ${request.email}`);
  }

  const userId = generateId();
  const createdAt = new Date().toISOString();

  return {
    id: userId,
    email: request.email,
    name: request.name,
    createdAt,
  };
}

/**
 * Find a user by their unique identifier.
 *
 * @param userId - The user's unique ID
 * @returns The user record, or null if not found
 */
export function findUserById(userId: string): UserRecord | null {
  const userMap = getUserStore();
  const found = userMap.get(userId);
  return found ?? null;
}

/**
 * List all users matching a given role.
 *
 * @param role - The role to filter by
 * @returns Array of matching user records
 */
export function listUsersByRole(role: string): UserRecord[] {
  const allUsers = getAllUsers();
  return allUsers.filter((user) => user.role === role);
}

/** Generate a simple unique identifier. */
function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

/** Retrieve the in-memory user store. */
function getUserStore(): Map<string, UserRecord> {
  return new Map();
}

/** Get all users from the store. */
function getAllUsers(): UserRecord[] {
  return [];
}
