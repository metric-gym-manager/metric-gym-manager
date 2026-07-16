/**
 * Cloudflare R2 Storage Provider
 *
 * Implements IStorageProvider using Cloudflare R2 via the S3-compatible API.
 *
 * R2 credentials are server-only environment variables:
 * - R2_ACCOUNT_ID: Cloudflare account id (forms the S3 endpoint)
 * - R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY: R2 API token credentials
 * - R2_BUCKET_NAME: target bucket
 * - NEXT_PUBLIC_R2_PUBLIC_URL: public base URL of the bucket (custom domain
 *   or r2.dev) used to compose read URLs client-side
 *
 * The primary flow is presigned PUT uploads: the backend signs a short-lived
 * URL bound to an exact object path + content type, and the browser uploads
 * the file directly to R2 — no image bytes pass through our servers.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  IStorageProvider,
  PresignedUpload,
  PresignedUploadOptions,
  UploadOptions,
  UploadResult,
} from '@/lib/storage/IStorageProvider';

/** Default presigned URL validity: 5 minutes */
const DEFAULT_PRESIGN_EXPIRY_SECONDS = 300;

/** Default max upload size: 5MB */
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export class R2StorageProvider implements IStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string | null;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        'Missing R2 configuration. Required env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME'
      );
    }

    this.bucket = bucket;
    this.publicBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
      ? process.env.NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/$/, '')
      : null;

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Generate a temporary presigned PUT URL bound to path + content type.
   */
  async getPresignedUploadUrl(
    path: string,
    options: PresignedUploadOptions
  ): Promise<PresignedUpload> {
    const expiresInSeconds =
      options.expiresInSeconds ?? DEFAULT_PRESIGN_EXPIRY_SECONDS;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: path,
      ContentType: options.contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });

    return { uploadUrl, path, expiresInSeconds };
  }

  /**
   * Upload a file server-side (secondary path; presigned PUT is preferred).
   */
  async upload(
    file: File | Blob,
    path: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    try {
      const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE_BYTES;
      if (file.size > maxSize) {
        return {
          success: false,
          error: `File exceeds maximum size of ${maxSize} bytes`,
        };
      }

      const body = new Uint8Array(await file.arrayBuffer());

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: path,
          Body: body,
          ContentType: options?.contentType,
          CacheControl: options?.cacheControl,
        })
      );

      const publicUrl = await this.getPublicUrl(path);

      return {
        success: true,
        path,
        publicUrl: publicUrl ?? undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async delete(path: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: path })
      );
      return true;
    } catch (error) {
      console.error(`Failed to delete R2 object ${path}:`, error);
      return false;
    }
  }

  /**
   * Compose the public read URL for an object.
   * Requires NEXT_PUBLIC_R2_PUBLIC_URL (public bucket custom domain / r2.dev).
   */
  async getPublicUrl(path: string): Promise<string | null> {
    if (!this.publicBaseUrl) {
      return null;
    }
    return `${this.publicBaseUrl}/${path}`;
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: path })
      );
      return true;
    } catch {
      return false;
    }
  }

  async list(path: string): Promise<string[]> {
    const result = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: path })
    );
    return (result.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => typeof key === 'string');
  }

  async getFileSize(path: string): Promise<number | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: path })
      );
      return result.ContentLength ?? null;
    } catch {
      return null;
    }
  }
}
