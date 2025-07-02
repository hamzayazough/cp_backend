export type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "FILE";

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  receiverId: string;
  type: MessageType;
  content?: string; // For text
  fileUrl?: string; // For image/video/file
  sentAt: Date;
  readAt?: Date; // Null if not yet read
  editedAt?: string;
  isDeleted?: boolean;
}
