import type { Hook } from '@hono/zod-openapi';
import * as z from 'zod';

import { log } from '@/lib/logger';
import type { ApiEnv } from '@/types';

import { validationError } from './responses';
import type { ValidationError } from './schemas';

// ============================================================================
// VALIDATION RESULT TYPES (Context7 Pattern)
// ============================================================================

export type ValidationSuccess<T> = {
  readonly success: true;
  readonly data: T;
};

export type ValidationFailure = {
  readonly success: false;
  readonly errors: ValidationError[];
};

// ValidationResult is a discriminated union with generic data type
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { data: result.data, success: true };
  }

  return {
    errors: result.error.issues.map(issue => ({
      code: issue.code,
      field: issue.path.join('.') || 'root',
      message: issue.message,
    })),
    success: false,
  };
}

// ============================================================================
// OPENAPI VALIDATION HOOK
// ============================================================================

export const UnknownInputSchema = z.unknown().openapi('UnknownInput');

export type UnknownInput = z.infer<typeof UnknownInputSchema>;

export const customValidationHook: Hook<UnknownInput, ApiEnv, string, UnknownInput> = (result, c) => {
  if (!result.success) {
    log.warn('[VALIDATION-HOOK] Validation failed', {
      issues: JSON.stringify(result.error.issues.slice(0, 5).map(i => ({
        code: i.code,
        message: i.message,
        path: i.path.join('.'),
      }))),
      path: c.req.path,
    });

    const errors = result.error.issues.map((err: z.ZodIssue) => ({
      code: err.code,
      field: err.path.join('.') || 'root',
      message: err.message,
    }));

    return validationError(c, errors, 'Request validation failed');
  }
  return undefined;
};
