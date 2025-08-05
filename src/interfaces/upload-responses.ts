import { Campaign } from './campaign';

export interface UploadMultipleFilesResponse {
  success: boolean;
  message: string;
  uploadedFiles: string[];
  failedFiles: string[];
  campaign?: Campaign;
}
