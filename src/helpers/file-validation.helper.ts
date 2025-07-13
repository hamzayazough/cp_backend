import { BadRequestException } from '@nestjs/common';
import { FILE_UPLOAD_CONSTANTS } from '../constants/file-upload.constants';

export class FileValidationHelper {
  /**
   * Validates if a file is provided
   */
  static validateFileExists(file: Express.Multer.File | undefined): void {
    if (!file) {
      throw new BadRequestException(
        FILE_UPLOAD_CONSTANTS.ERROR_MESSAGES.NO_FILE,
      );
    }
  }

  /**
   * Validates file size against maximum allowed size
   */
  static validateFileSize(file: Express.Multer.File): void {
    if (file.size > FILE_UPLOAD_CONSTANTS.MAX_FILE_SIZE) {
      throw new BadRequestException(
        FILE_UPLOAD_CONSTANTS.ERROR_MESSAGES.FILE_TOO_LARGE,
      );
    }
  }

  /**
   * Validates file type against allowed MIME types
   */
  static validateFileType(file: Express.Multer.File): void {
    if (
      !FILE_UPLOAD_CONSTANTS.ALL_ALLOWED_MIME_TYPES.includes(
        file.mimetype as any,
      )
    ) {
      throw new BadRequestException(
        FILE_UPLOAD_CONSTANTS.ERROR_MESSAGES.INVALID_FILE_TYPE,
      );
    }
  }

  /**
   * Validates all file constraints (existence, size, type)
   */
  static validateFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    this.validateFileExists(file);
    // After validateFileExists, TypeScript knows file is not undefined
    this.validateFileSize(file!);
    this.validateFileType(file!);
  }

  /**
   * Generates a unique file key for S3 storage
   */
  static generateFileKey(
    firebaseUid: string,
    originalName: string,
    uuid: string,
  ): string {
    const fileExtension = originalName.split('.').pop();
    return `campaign-media/${firebaseUid}/${uuid}.${fileExtension}`;
  }
}
