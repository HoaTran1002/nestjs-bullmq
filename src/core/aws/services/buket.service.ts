import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2CommandOutput,
  waitUntilObjectNotExists,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@/core/config/config.service';
import { LoggerService } from '@/core/logging/logger.service';
import { Readable } from 'stream';

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
  expires?: Date;
  ACL?: 'public-read' | 'private';
}

export interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface ListOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListResult {
  files: FileInfo[];
  isTruncated: boolean;
  nextContinuationToken?: string;
  totalCount: number;
}

export interface PresignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
  responseContentType?: string;
  responseContentDisposition?: string;
}

/**
 * Service for managing S3 bucket operations
 * Provides a high-level interface for common S3 operations
 */
@Injectable()
export class BucketService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(BucketService.name);
    this.region = this.configService.awsRegion;
    this.bucketName = this.configService.s3BucketName;

    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is required');
    }

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.awsAccessKeyId,
        secretAccessKey: this.configService.awsSecretAccessKey,
      },
    });

    this.logger.log(
      `BucketService initialized with bucket: ${this.bucketName} in region: ${this.region}`,
      'BucketService',
    );
  }

  /**
   * Upload a file to S3
   * @param key - The S3 key (path) for the file
   * @param body - File content as Buffer, string, or Readable stream
   * @param options - Upload options
   * @returns Promise<void>
   */
  async uploadFile(
    key: string,
    body: Buffer | string | Readable,
    options: UploadOptions = {},
  ): Promise<{ url: string }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          ...options.metadata,
        },
        CacheControl: options.cacheControl,
        Expires: options.expires,
        ACL: options.ACL || 'private',
      });

      await this.s3Client.send(command);

      const region = this.region;
      const url = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;

      this.logger.log(`File uploaded successfully: ${key}`, 'BucketService');
      return { url };
    } catch (error) {
      this.logger.error(
        `Failed to upload file: ${key}`,
        error.stack,
        'BucketService',
      );
      throw error;
    }
  }

  /**
   * Download a file from S3
   * @param key - The S3 key (path) for the file
   * @returns Promise<Buffer> - File content as Buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const chunks: Uint8Array[] = [];

      if (response.Body instanceof Readable) {
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
      }

      const buffer = Buffer.concat(chunks);
      this.logger.log(`File downloaded successfully: ${key}`, 'BucketService');
      return buffer;
    } catch (error) {
      this.logger.error(
        `Failed to download file: ${key}`,
        error.stack,
        'BucketService',
      );
      throw error;
    }
  }

  /**
   * Delete a file from S3
   * @param key - The S3 key (path) for the file
   * @returns Promise<void>
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${key}`, 'BucketService');
    } catch (error) {
      this.logger.error(
        `Failed to delete file: ${key}`,
        error.stack,
        'BucketService',
      );
      throw error;
    }
  }

  /**
   * Delete multiple files from S3
   * @param keys - Array of S3 keys to delete
   * @returns Promise<void>
   */
  async deleteFiles(keys: string[]): Promise<void> {
    try {
      const deletePromises = keys.map((key) => this.deleteFile(key));
      await Promise.all(deletePromises);
      this.logger.log(
        `${keys.length} files deleted successfully`,
        'BucketService',
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete multiple files`,
        error.stack,
        'BucketService',
      );
      throw error;
    }
  }

  /**
   * Check if a file exists in S3
   * @param key - The S3 key (path) for the file
   * @returns Promise<FileInfo | null> - File information or null if not found
   */
  async fileExists(key: string): Promise<FileInfo | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        etag: response.ETag || '',
        contentType: response.ContentType,
        metadata: response.Metadata,
      };
    } catch (error) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      this.logger.error(
        `Failed to check file existence: ${key}`,
        error.stack,
        'BucketService',
      );
      throw error;
    }
  }

  /**
   * List files in S3 with optional prefix
   * @param options - List options
   * @returns Promise<ListResult> - List of files and pagination info
   */
  async listFiles(options: ListOptions = {}): Promise<ListResult> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: options.prefix,
        MaxKeys: options.maxKeys || 1000,
        ContinuationToken: options.continuationToken,
      });

      const response = await this.s3Client.send(command);
      const files: FileInfo[] = (response.Contents || []).map((obj) => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        etag: obj.ETag || '',
      }));

      return {
        files,
        isTruncated: response.IsTruncated || false,
        nextContinuationToken: response.NextContinuationToken,
        totalCount: response.KeyCount || 0,
      };
    } catch (error) {
      this.logger.error(
        `Failed to list files with prefix: ${options.prefix}`,
        error.stack,
        'BucketService',
      );
      throw error;
    }
  }

  /**
   * Generate a presigned URL for file download
   * @param key - The S3 key (path) for the file
   * @param options - Presigned URL options
   * @returns Promise<string> - Presigned URL
   */
  async generatePresignedDownloadUrl(
    key: string,
    options: PresignedUrlOptions = {},
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ResponseContentType: options.responseContentType,
        ResponseContentDisposition: options.responseContentDisposition,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: options.expiresIn || 3600, // 1 hour default
      });

      this.logger.log(
        `Presigned download URL generated for: ${key}`,
        'BucketService',
      );
      return url;
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for: ${key}`,
        error.stack,
        'BucketService',
      );
      throw error;
    }
  }

  /**
   * Generate a presigned URL for file upload
   * @param key - The S3 key (path) for the file
   * @param options - Presigned URL options
   * @returns Promise<string> - Presigned URL
   */
  async generatePresignedUploadUrl(
    key: string,
    options: PresignedUrlOptions & { contentType?: string } = {},
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: options.contentType,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: options.expiresIn || 3600, // 1 hour default
      });

      this.logger.log(
        `Presigned upload URL generated for: ${key}`,
        'BucketService',
      );
      return url;
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned upload URL for: ${key}`,
        error.stack,
        'BucketService',
      );
      throw error;
    }
  }

  /**
   * Copy a file within S3
   * @param sourceKey - Source S3 key
   * @param destinationKey - Destination S3 key
   * @param options - Copy options
   * @returns Promise<void>
   */
  async copyFile(
    sourceKey: string,
    destinationKey: string,
    options: UploadOptions = {},
  ): Promise<void> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
        ContentType: options.contentType,
        Metadata: options.metadata,
        MetadataDirective: options.metadata ? 'REPLACE' : 'COPY',
      });

      await this.s3Client.send(command);
      this.logger.log(
        `File copied from ${sourceKey} to ${destinationKey}`,
        'BucketService',
      );
    } catch (error) {
      this.logger.error(
        `Failed to copy file from ${sourceKey} to ${destinationKey}`,
        error.stack,
        'BucketService',
      );
      throw error;
    }
  }

  /**
   * Get the bucket name
   * @returns string - Bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }

  /**
   * Get the AWS region
   * @returns string - AWS region
   */
  getRegion(): string {
    return this.region;
  }

  /**
   * Generate a standardized S3 key with prefix
   * @param prefix - Key prefix (e.g., 'exports', 'uploads')
   * @param identifier - Unique identifier (e.g., project ID, user ID)
   * @param filename - File name
   * @returns string - Generated S3 key
   */
  generateKey(
    prefix: string,
    identifier: string | number,
    filename: string,
  ): string {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${prefix}/${identifier}/${sanitizedFilename}`;
  }

  /**
   * Extract filename from S3 key
   * @param key - S3 key
   * @returns string - Extracted filename
   */
  extractFilename(key: string): string {
    return key.split('/').pop() || 'file';
  }

  /**
   * Delete all files in a folder from S3
   * @param folderPrefix - The S3 folder prefix (path)
   * @returns Promise<void>
   */
  async deleteFolder(bucketName: string, folderPath: string) {
    try {
      const listObjectsParams = {
        Bucket: bucketName,
        Prefix: folderPath,
      };

      const listedObjects = await this.s3Client.send(
        new ListObjectsV2Command(listObjectsParams),
      );

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        console.log(
          `Folder "${folderPath}" is already empty or does not exist.`,
        );
        return;
      }

      const deleteParams = {
        Bucket: bucketName,
        Delete: { Objects: [] as { Key: string }[] },
      };

      listedObjects.Contents.forEach(({ Key }) => {
        if (Key) deleteParams.Delete.Objects.push({ Key });
      });

      const deleteResponse = await this.s3Client.send(
        new DeleteObjectsCommand(deleteParams),
      );

      console.log(
        `Successfully deleted ${deleteResponse.Deleted?.length} objects in folder: ${folderPath}`,
      );

      for (const obj of deleteParams.Delete.Objects) {
        await waitUntilObjectNotExists(
          { client: this.s3Client, maxWaitTime: 60 },
          { Bucket: bucketName, Key: obj.Key },
        );
      }

      if (listedObjects.IsTruncated) {
        await this.deleteFolder(bucketName, folderPath);
      }
    } catch (error) {
      console.error(`Error deleting folder ${folderPath}:`, error);
    }
  }
}
