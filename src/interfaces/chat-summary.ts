export interface ChatSummary {
  threadId: string;
  partnerName: string;
  partnerAvatarUrl?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}
