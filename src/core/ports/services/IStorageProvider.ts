/**
 * Storage Provider Interface (Port)
 *
 * Defines the contract for file storage services.
 * This abstracts the storage provider (Supabase Storage, S3, etc.) from the business logic.
 */

/**
 * File upload options
 */
export interface UploadOptions {
  /**
   * Content type (MIME type)
   * Example: 'image/jpeg', 'application/pdf'
   */
  contentType?: string;

  /**
   * Whether to make the file publicly accessible
   * Default: false
   */
  isPublic?: boolean;

  /**
   * Cache control header
   * Example: 'max-age=3600'
   */
  cacheControl?: string;

  /**
   * Maximum file size in bytes
   * Default: 5MB
   */
  maxSize?: number;
}

/**
 * File upload result
 */
export interface UploadResult {
  /**
   * Whether upload was successful
   */
  success: boolean;

  /**
   * Path to the uploaded file
   * Only present if success is true
   */
  path?: string;

  /**
   * Public URL to access the file
   * Only present if success is true and isPublic is true
   */
  publicUrl?: string;

  /**
   * Error message if upload failed
   * Only present if success is false
   */
  error?: string;
}

/**
 * Storage Provider Interface
 *
 * This defines operations for file storage.
 * Infrastructure layer will implement this interface using Supabase Storage, S3, etc.
 *
 * @example
 * // Upload gym profile image
 * const result = await storageProvider.upload(
 *   imageFile,
 *   'gym-profiles/gym-123.jpg',
 *   { contentType: 'image/jpeg', isPublic: true }
 * );
 *
 * if (result.success) {
 *   console.log('Image URL:', result.publicUrl);
 * }
 *
 * @example
 * // Delete file
 * await storageProvider.delete('gym-profiles/gym-123.jpg');
 */
export interface IStorageProvider {
  /**
   * Upload a file
   *
   * @param file - File to upload (File or Blob)
   * @param path - Destination path (e.g., 'gym-profiles/gym-123.jpg')
   * @param options - Upload options
   * @returns Upload result
   */
  upload(
    file: File | Blob,
    path: string,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Delete a file
   *
   * @param path - Path to the file to delete
   * @returns True if deleted successfully
   */
  delete(path: string): Promise<boolean>;

  /**
   * Get public URL for a file
   *
   * @param path - Path to the file
   * @returns Public URL, or null if file doesn't exist
   */
  getPublicUrl(path: string): Promise<string | null>;

  /**
   * Check if a file exists
   *
   * @param path - Path to check
   * @returns True if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * List files in a directory
   *
   * @param path - Directory path
   * @returns Array of file paths
   */
  list(path: string): Promise<string[]>;

  /**
   * Get file size
   *
   * @param path - Path to the file
   * @returns File size in bytes, or null if file doesn't exist
   */
  getFileSize(path: string): Promise<number | null>;
}
