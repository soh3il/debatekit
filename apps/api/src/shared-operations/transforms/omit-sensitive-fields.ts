/**
 * Sensitive Field Omission Utilities
 *
 * Type-safe transformations for removing sensitive fields from responses.
 */

/**
 * Result of omitting r2Key from an object's upload field.
 * Replaces the upload property with a version that excludes r2Key.
 */
export type WithSanitizedUpload<T extends { upload: { r2Key: string } }> = Omit<T, 'upload'> & {
  upload: Omit<T['upload'], 'r2Key'>;
};

/**
 * Omit r2Key from upload within a parent object
 *
 * @example
 * ```ts
 * const attachment = omitUploadR2Key(projectAttachment);
 * // attachment.upload.r2Key is removed
 * ```
 */
export function omitUploadR2Key<T extends { upload: { r2Key: string } }>(
  obj: T,
) {
  const { r2Key: _r2Key, ...uploadWithoutR2Key } = obj.upload;
  return {
    ...obj,
    upload: uploadWithoutR2Key,
  };
}
