import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export enum S3FileType {
  USER_AVATAR = 'user-avatars',
  USER_BACKGROUND = 'user-backgrounds',
  PROMOTER_WORK = 'promoter-works',
  CAMPAIGN_PRODUCT = 'campaign-products',
}

export interface UploadResult {
  key: string;
  url: string;
  publicUrl: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const bucketName = this.configService.get<string>('AWS_S3_BUCKET');
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    if (!bucketName || !region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'AWS configuration is incomplete. Required: AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY',
      );
    }

    this.bucketName = bucketName;

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Generate a file key for S3 storage
   */
  private generateFileKey(
    type: S3FileType,
    userId: string,
    fileName: string,
    options?: {
      campaignId?: string;
      version?: number;
      workId?: string;
    },
  ): string {
    const fileExtension = fileName.split('.').pop();
    const uniqueId = uuidv4();

    switch (type) {
      case S3FileType.USER_AVATAR:
        return `${type}/${userId}/avatar.${fileExtension}`;

      case S3FileType.USER_BACKGROUND:
        return `${type}/${userId}/background.${fileExtension}`;

      case S3FileType.PROMOTER_WORK: {
        const workId = options?.workId || uniqueId;
        return `${type}/${userId}/${workId}_${uniqueId}.${fileExtension}`;
      }

      case S3FileType.CAMPAIGN_PRODUCT: {
        if (!options?.campaignId) {
          throw new BadRequestException(
            'Campaign ID is required for campaign products',
          );
        }
        const version = options.version || 1;
        return `${type}/${userId}/${options.campaignId}/product_v${version}_${uniqueId}.${fileExtension}`;
      }

      default:
        throw new BadRequestException('Invalid file type');
    }
  }

  /**
   * Get public URL for a file
   */
  public getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;
  }

  /**
   * Upload a file buffer to S3
   */
  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    type: S3FileType,
    userId: string,
    options?: {
      campaignId?: string;
      version?: number;
      workId?: string;
    },
  ): Promise<UploadResult> {
    try {
      const key = this.generateFileKey(type, userId, fileName, options);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ACL: 'public-read',
      });

      await this.s3Client.send(command);

      const publicUrl = this.getPublicUrl(key);

      return {
        key,
        url: publicUrl,
        publicUrl,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to upload file: ${message}`);
    }
  }

  /**
   * Generate a presigned URL for direct upload from frontend
   */
  async generatePresignedUploadUrl(
    fileName: string,
    mimeType: string,
    type: S3FileType,
    userId: string,
    options?: {
      campaignId?: string;
      version?: number;
      workId?: string;
      expiresIn?: number;
    },
  ): Promise<PresignedUrlResult> {
    try {
      const key = this.generateFileKey(type, userId, fileName, options);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: mimeType,
        ACL: 'public-read',
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: options?.expiresIn || 3600,
      });

      const publicUrl = this.getPublicUrl(key);

      return {
        uploadUrl,
        key,
        publicUrl,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to generate presigned URL: ${message}`,
      );
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to delete file: ${message}`);
    }
  }

  /**
   * Delete an object from S3
   */
  async deleteObject(key: string): Promise<void> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(deleteCommand);
    } catch (error) {
      console.error('Error deleting object from S3:', error);
      throw new BadRequestException('Failed to delete file from S3');
    }
  }

  /**
   * Get a signed URL for downloading/viewing a private file
   */
  async generateSignedDownloadUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to generate download URL: ${message}`,
      );
    }
  }

  /**
   * Extract S3 key from URL
   */
  extractKeyFromUrl(url: string): string {
    try {
      const urlParts = url.split('/');
      // For our bucket structure, the key is everything after the bucket name
      // Example: https://bucketname.s3.region.amazonaws.com/user-avatars/uid/filename
      const bucketIndex = urlParts.findIndex((part) =>
        part.includes(this.bucketName),
      );
      if (bucketIndex === -1) {
        throw new Error('Invalid S3 URL format');
      }
      return urlParts.slice(bucketIndex + 1).join('/');
    } catch (error) {
      console.error('Error extracting key from URL:', error);
      throw new BadRequestException('Invalid S3 URL format');
    }
  }

  /**
   * Helper methods for specific file types
   */

  // User Avatar
  async uploadUserAvatar(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
  ): Promise<UploadResult> {
    return this.uploadFile(
      buffer,
      fileName,
      mimeType,
      S3FileType.USER_AVATAR,
      userId,
    );
  }

  async generateAvatarUploadUrl(
    fileName: string,
    mimeType: string,
    userId: string,
  ): Promise<PresignedUrlResult> {
    return this.generatePresignedUploadUrl(
      fileName,
      mimeType,
      S3FileType.USER_AVATAR,
      userId,
    );
  }

  // User Background
  async uploadUserBackground(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
  ): Promise<UploadResult> {
    return this.uploadFile(
      buffer,
      fileName,
      mimeType,
      S3FileType.USER_BACKGROUND,
      userId,
    );
  }

  async generateBackgroundUploadUrl(
    fileName: string,
    mimeType: string,
    userId: string,
  ): Promise<PresignedUrlResult> {
    return this.generatePresignedUploadUrl(
      fileName,
      mimeType,
      S3FileType.USER_BACKGROUND,
      userId,
    );
  }

  // Promoter Work
  async uploadPromoterWork(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
    workId?: string,
  ): Promise<UploadResult> {
    return this.uploadFile(
      buffer,
      fileName,
      mimeType,
      S3FileType.PROMOTER_WORK,
      userId,
      { workId },
    );
  }

  async generatePromoterWorkUploadUrl(
    fileName: string,
    mimeType: string,
    userId: string,
    workId?: string,
  ): Promise<PresignedUrlResult> {
    return this.generatePresignedUploadUrl(
      fileName,
      mimeType,
      S3FileType.PROMOTER_WORK,
      userId,
      { workId },
    );
  }

  // Campaign Product
  async uploadCampaignProduct(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
    campaignId: string,
    version: number = 1,
  ): Promise<UploadResult> {
    return this.uploadFile(
      buffer,
      fileName,
      mimeType,
      S3FileType.CAMPAIGN_PRODUCT,
      userId,
      { campaignId, version },
    );
  }

  async generateCampaignProductUploadUrl(
    fileName: string,
    mimeType: string,
    userId: string,
    campaignId: string,
    version: number = 1,
  ): Promise<PresignedUrlResult> {
    return this.generatePresignedUploadUrl(
      fileName,
      mimeType,
      S3FileType.CAMPAIGN_PRODUCT,
      userId,
      { campaignId, version },
    );
  }
}
