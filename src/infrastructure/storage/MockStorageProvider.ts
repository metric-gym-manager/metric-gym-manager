/**
 * Mock Storage Provider
 *
 * In-memory IStorageProvider implementation for development and tests.
 * Mirrors the MockSMSProvider pattern: no external calls, deterministic
 * results, and inspectable state.
 */

import type {
  IStorageProvider,
  PresignedUpload,
  PresignedUploadOptions,
  UploadOptions,
  UploadResult,
} from '@/core/ports/services/IStorageProvider';

export class MockStorageProvider implements IStorageProvider {
  /** Object paths "stored" via upload(), inspectable in tests */
  public readonly storedPaths = new Map<string, number>();

  /** Presigned URLs issued, inspectable in tests */
  public readonly issuedPresigns: PresignedUpload[] = [];

  async getPresignedUploadUrl(
    path: string,
    options: PresignedUploadOptions
  ): Promise<PresignedUpload> {
    const presign: PresignedUpload = {
      uploadUrl: `https://mock-r2.local/${path}?signature=mock&content-type=${encodeURIComponent(options.contentType)}`,
      path,
      expiresInSeconds: options.expiresInSeconds ?? 300,
    };
    this.issuedPresigns.push(presign);
    return presign;
  }

  async upload(
    file: File | Blob,
    path: string,
    _options?: UploadOptions
  ): Promise<UploadResult> {
    this.storedPaths.set(path, file.size);
    return {
      success: true,
      path,
      publicUrl: `https://mock-r2.local/${path}`,
    };
  }

  async delete(path: string): Promise<boolean> {
    return this.storedPaths.delete(path);
  }

  async getPublicUrl(path: string): Promise<string | null> {
    return `https://mock-r2.local/${path}`;
  }

  async exists(path: string): Promise<boolean> {
    return this.storedPaths.has(path);
  }

  async list(path: string): Promise<string[]> {
    return Array.from(this.storedPaths.keys()).filter((key) =>
      key.startsWith(path)
    );
  }

  async getFileSize(path: string): Promise<number | null> {
    return this.storedPaths.get(path) ?? null;
  }
}
