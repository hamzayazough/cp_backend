export interface MessageThread {
  id: string;
  campaignId: string;
  promoterId: string;
  advertiserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderType: 'ADVERTISER' | 'ADMIN' | 'SYSTEM';
  content: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced messaging interfaces
export interface MessageThreadDetails extends MessageThread {
  campaignTitle: string;
  promoterName: string;
  advertiserName: string;
  lastMessage?: Message;
  unreadCount: number;
  participantAvatars: {
    promoter?: string;
    advertiser?: string;
  };
}

export interface SendMessageRequest {
  threadId: string;
  senderId: string;
  content: string;
  senderType: 'ADVERTISER' | 'ADMIN' | 'SYSTEM';
}

export interface CreateThreadRequest {
  campaignId: string;
  promoterId: string;
  advertiserId: string;
  initialMessage?: string;
}

export interface MessageList {
  threadId: string;
  messages: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
