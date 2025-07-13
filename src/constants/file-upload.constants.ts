const ALLOWED_IMAGES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

const ALLOWED_VIDEOS = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

const ALLOWED_DOCUMENTS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
] as const;

export const FILE_UPLOAD_CONSTANTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB

  ALLOWED_MIME_TYPES: {
    IMAGES: ALLOWED_IMAGES,
    VIDEOS: ALLOWED_VIDEOS,
    DOCUMENTS: ALLOWED_DOCUMENTS,
  },

  ALL_ALLOWED_MIME_TYPES: [
    ...ALLOWED_IMAGES,
    ...ALLOWED_VIDEOS,
    ...ALLOWED_DOCUMENTS,
  ] as const,

  ERROR_MESSAGES: {
    NO_FILE: 'No file provided',
    FILE_TOO_LARGE: 'File size too large. Maximum size is 10MB',
    INVALID_FILE_TYPE:
      'Invalid file type. Only images, videos, and documents (PDF, Word, Excel, PowerPoint, TXT, CSV) are allowed',
    UPLOAD_FAILED: 'Failed to upload file',
  },
} as const;
