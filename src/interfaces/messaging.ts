import { MessageSenderType } from '../enums/message-sender-type';

export interface CreateMessageThreadRequest {
  campaignId: string;
  subject?: string;
}

export interface CreateMessageRequest {
  threadId: string;
  content: string;
  senderType: MessageSenderType;
}

export interface MessageResponse {
  id: string;
  threadId: string;
  senderId: string;
  senderType: MessageSenderType;
  content: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
  sender?: {
    id: string;
    username: string;
    profilePictureUrl?: string;
  };
}

export interface MessageThreadResponse {
  id: string;
  campaignId: string;
  promoterId: string;
  advertiserId: string;
  subject?: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  campaign?: {
    id: string;
    title: string;
    isPublic: boolean;
  };
  promoter?: {
    id: string;
    username: string;
    profilePictureUrl?: string;
  };
  advertiser?: {
    id: string;
    username: string;
    profilePictureUrl?: string;
  };
  messages?: MessageResponse[];
  unreadCount?: number;
}

export interface GetMessagesRequest {
  threadId: string;
  page?: number;
  limit?: number;
  before?: Date;
}

export interface GetThreadsRequest {
  userId: string;
  page?: number;
  limit?: number;
  campaignId?: string;
}

export interface GetThreadByCampaignRequest {
  campaignId: string;
  userId: string; // Can be either promoterId or advertiserId
}

export interface MarkMessageAsReadRequest {
  messageId: string;
}

export interface MarkThreadAsReadRequest {
  threadId: string;
  userId: string;
}

// WebSocket event interfaces
export interface JoinThreadPayload {
  threadId: string;
  userId: string;
}

export interface SendMessagePayload {
  threadId: string;
  content: string;
  senderType: MessageSenderType;
}

export interface MessageNotificationPayload {
  type: 'new_message' | 'message_read' | 'thread_created';
  threadId: string;
  message?: MessageResponse;
  thread?: MessageThreadResponse;
  recipientId: string;
}
