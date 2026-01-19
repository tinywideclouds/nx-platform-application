import { Signal, computed, isSignal } from '@angular/core';
import * as v from 'valibot';

export type ValidationSchema<T = unknown> = v.BaseSchema<unknown, T, any>;

/**
 * Creates a computed signal that returns the first validation error message,
 * or null if the value is valid.
 *
 * Accepts either a static Schema object OR a Signal<Schema>.
 */
export function computedError<T>(
  schemaOrSignal: ValidationSchema<T> | Signal<ValidationSchema<T>>,
  valueSignal: Signal<unknown>,
): Signal<string | null> {
  return computed(() => {
    const value = valueSignal();
    // Unwrap the schema if it's a signal, otherwise use it directly
    const schema = isSignal(schemaOrSignal) ? schemaOrSignal() : schemaOrSignal;

    const result = v.safeParse(schema, value);
    return result.success ? null : result.issues[0].message;
  });
}

/**
 * Synchronously validates a value against a schema.
 * Returns true if valid, false if invalid.
 */
export function validate<T>(
  schema: v.BaseSchema<unknown, T, any>,
  value: unknown,
): boolean {
  return v.safeParse(schema, value).success;
}

// --- REUSABLE SCHEMAS ---

export const EmailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Email is required'),
  v.email('Invalid email format'),
);

export const PhoneSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Phone number is required'),
  // Permissive Global (Allows +123 456 7890 etc)
  v.regex(/^\+?[\d\s\-\.]{7,15}$/, 'Invalid phone number format'),
);

export const NameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('This field is required'),
  v.minLength(2, 'Must be at least 2 characters'),
);

export const AliasSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Alias is required'),
  v.regex(/^[a-zA-Z0-9_]+$/, 'Alias must be alphanumeric'),
);
