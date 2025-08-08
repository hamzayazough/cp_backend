# Messaging System Integration Guide

## Overview
The messaging system is now fully implemented with both REST API and WebSocket support for real-time communication.

## Architecture

### Components
1. **Database Entities**: `MessageThread`, `Message`, `ChatSummary`
2. **REST API**: `MessagingController` with full CRUD operations
3. **WebSocket Gateway**: `MessagingGateway` for real-time communication
4. **Service Layer**: `MessagingService` with comprehensive business logic

## WebSocket Events

### Client -> Server Events
- `joinThread`: Join a specific message thread
- `leaveThread`: Leave a message thread
- `sendMessage`: Send a message to a thread
- `markAsRead`: Mark messages/threads as read
- `typing`: Indicate typing status

### Server -> Client Events
- `connected`: Connection established
- `threadJoined`: Successfully joined thread
- `threadLeft`: Successfully left thread
- `newMessage`: New message received
- `messageRead`: Message marked as read
- `threadRead`: Thread marked as read
- `userTyping`: User typing indicator
- `notification`: General notifications
- `error`: Error messages

## REST API Endpoints

```
POST   /messaging/threads                      - Create message thread
GET    /messaging/threads                      - Get user's threads
GET    /messaging/threads/:id                  - Get specific thread
POST   /messaging/threads/:id/messages         - Send message (with real-time broadcast)
GET    /messaging/threads/:id/messages         - Get thread messages
PATCH  /messaging/messages/:id/read            - Mark message as read
PATCH  /messaging/threads/:id/read             - Mark thread as read
POST   /messaging/threads/:id/summaries        - Create AI summary
GET    /messaging/threads/:id/summaries        - Get thread summaries
GET    /messaging/campaigns/:id/thread         - Get campaign thread
```

## Data Structures & TypeScript Interfaces

### Core Message Types

```typescript
// Message sender types
type MessageSenderType = 'ADVERTISER' | 'PROMOTER' | 'ADMIN' | 'SYSTEM';
type UserRole = 'ADVERTISER' | 'PROMOTER' | 'ADMIN';

// User information in messages
interface UserInfo {
  id: string;
  firebaseUid: string;
  username: string; // maps to user.name in backend
  profilePictureUrl?: string; // maps to user.avatarUrl in backend
}

// Campaign information in threads
interface CampaignInfo {
  id: string;
  title: string;
  isPublic: boolean;
}
```

### Request/Response Objects

```typescript
// Create Thread Request
interface CreateMessageThreadRequest {
  campaignId: string;
  promoterId: string;
  advertiserId: string;
  subject?: string;
}

// Send Message Request  
interface CreateMessageRequest {
  threadId: string;
  content: string;
  senderType: MessageSenderType; // Auto-determined by backend based on user role
}

// Message Response Object
interface MessageResponse {
  id: string;
  threadId: string;
  senderId: string;
  senderType: MessageSenderType;
  content: string;
  isRead: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  sender?: UserInfo;
}

// Message Thread Response Object
interface MessageThreadResponse {
  id: string;
  campaignId: string;
  promoterId: string;
  advertiserId: string;
  subject?: string;
  lastMessageAt: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  campaign?: CampaignInfo;
  promoter?: UserInfo;
  advertiser?: UserInfo;
  unreadCount?: number; // Only included in getThreads response
  messages?: MessageResponse[]; // Only latest message in getThreads response
}

// Chat Summary Response
interface ChatSummaryResponse {
  id: string;
  threadId: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  sentimentScore?: number; // -1.00 to 1.00
  createdAt: string;
  updatedAt: string;
}

// Create Chat Summary Request
interface CreateChatSummaryRequest {
  threadId: string;
  summary: string;
  keyPoints?: string[];
  actionItems?: string[];
  sentimentScore?: number;
}

// Mark as Read Requests
interface MarkMessageAsReadRequest {
  messageId: string;
}

interface MarkThreadAsReadRequest {
  threadId: string;
  userId: string;
}

// Query Parameters for GET requests
interface GetMessagesRequest {
  threadId: string;
  page?: number;
  limit?: number;
  before?: Date; // For pagination, get messages before this date
}

interface GetThreadsRequest {
  userId: string;
  page?: number;
  limit?: number;
  campaignId?: string; // Filter by campaign
}
```

### WebSocket Event Payloads

```typescript
// Client -> Server Events
interface JoinThreadPayload {
  threadId: string;
}

interface SendMessagePayload {
  threadId: string;
  content: string;
}

interface MarkAsReadPayload {
  threadId?: string; // For marking entire thread as read
  messageId?: string; // For marking single message as read
}

interface TypingPayload {
  threadId: string;
  isTyping: boolean;
}

// Server -> Client Events
interface ConnectedPayload {
  userId: string;
  role: UserRole;
  message: string;
}

interface ThreadJoinedPayload {
  threadId: string;
}

interface ThreadLeftPayload {
  threadId: string;
}

interface NewMessagePayload extends MessageResponse {
  // Same as MessageResponse
}

interface MessageReadPayload {
  messageId: string;
  userId: string;
}

interface ThreadReadPayload {
  threadId: string;
  userId: string;
}

interface UserTypingPayload {
  threadId: string;
  userId: string;
  isTyping: boolean;
}

interface NotificationPayload {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  data?: any;
}

interface ErrorPayload {
  message: string;
  code?: string;
}
```

### API Response Examples

```typescript
// GET /messaging/threads response
const threadsResponse: MessageThreadResponse[] = [
  {
    id: "thread-uuid-1",
    campaignId: "campaign-uuid-1",
    promoterId: "promoter-uuid-1", 
    advertiserId: "advertiser-uuid-1",
    subject: "Campaign Discussion",
    lastMessageAt: "2025-08-08T10:30:00Z",
    createdAt: "2025-08-08T09:00:00Z",
    updatedAt: "2025-08-08T10:30:00Z",
    unreadCount: 2,
    campaign: {
      id: "campaign-uuid-1",
      title: "Summer Fashion Campaign",
      isPublic: false
    },
    promoter: {
      id: "promoter-uuid-1",
      firebaseUid: "firebase-promoter-uid",
      username: "John Doe",
      profilePictureUrl: "https://s3.bucket/avatar1.jpg"
    },
    advertiser: {
      id: "advertiser-uuid-1", 
      firebaseUid: "firebase-advertiser-uid",
      username: "Fashion Brand Co",
      profilePictureUrl: "https://s3.bucket/avatar2.jpg"
    },
    messages: [
      {
        id: "message-uuid-1",
        threadId: "thread-uuid-1",
        senderId: "advertiser-uuid-1",
        senderType: "ADVERTISER",
        content: "Hi! Looking forward to working with you on this campaign.",
        isRead: false,
        createdAt: "2025-08-08T10:30:00Z",
        updatedAt: "2025-08-08T10:30:00Z",
        sender: {
          id: "advertiser-uuid-1",
          firebaseUid: "firebase-advertiser-uid", 
          username: "Fashion Brand Co",
          profilePictureUrl: "https://s3.bucket/avatar2.jpg"
        }
      }
    ]
  }
];

// GET /messaging/threads/:id/messages response
const messagesResponse: MessageResponse[] = [
  {
    id: "message-uuid-1",
    threadId: "thread-uuid-1", 
    senderId: "advertiser-uuid-1",
    senderType: "ADVERTISER",
    content: "Hi! Looking forward to working with you on this campaign.",
    isRead: true,
    createdAt: "2025-08-08T09:15:00Z",
    updatedAt: "2025-08-08T10:00:00Z",
    sender: {
      id: "advertiser-uuid-1",
      firebaseUid: "firebase-advertiser-uid",
      username: "Fashion Brand Co", 
      profilePictureUrl: "https://s3.bucket/avatar2.jpg"
    }
  },
  {
    id: "message-uuid-2",
    threadId: "thread-uuid-1",
    senderId: "promoter-uuid-1", 
    senderType: "PROMOTER",
    content: "Absolutely! I have some great ideas for this campaign.",
    isRead: false,
    createdAt: "2025-08-08T10:30:00Z",
    updatedAt: "2025-08-08T10:30:00Z",
    sender: {
      id: "promoter-uuid-1",
      firebaseUid: "firebase-promoter-uid",
      username: "John Doe",
      profilePictureUrl: "https://s3.bucket/avatar1.jpg" 
    }
  }
];

// POST /messaging/threads/:id/messages request body
const sendMessageRequest = {
  content: "That sounds great! Let's discuss the timeline."
};

// POST /messaging/threads/:id/messages response
const sendMessageResponse: MessageResponse = {
  id: "message-uuid-3",
  threadId: "thread-uuid-1",
  senderId: "advertiser-uuid-1",
  senderType: "ADVERTISER", 
  content: "That sounds great! Let's discuss the timeline.",
  isRead: false,
  createdAt: "2025-08-08T10:35:00Z",
  updatedAt: "2025-08-08T10:35:00Z",
  sender: {
    id: "advertiser-uuid-1",
    firebaseUid: "firebase-advertiser-uid",
    username: "Fashion Brand Co",
    profilePictureUrl: "https://s3.bucket/avatar2.jpg"
  }
};
```

## Integration Examples

### 1. Auto-Create Thread on Contract Acceptance

```typescript
// In PromoterCampaignInteractionService.acceptContract()
async acceptContract(
  firebaseUid: string,
  request: AcceptContractRequest,
): Promise<AcceptContractResponse> {
  const promoter = await this.findPromoterByFirebaseUid(firebaseUid);
  const campaign = await this.findActiveCampaign(request.campaignId);

  // ... existing validation logic ...

  const savedContract = await this.createPromoterCampaign(
    promoter.id,
    request.campaignId,
  );

  // Auto-create message thread for private campaigns
  if (!campaign.isPublic) {
    try {
      await this.messagingService.createThreadForPrivateCampaign(
        campaign.id,
        promoter.id,
        campaign.advertiserId,
      );
    } catch (error) {
      // Log error but don't fail the contract acceptance
      this.logger.warn('Failed to create message thread:', error);
    }
  }

  return RESPONSE_BUILDERS.buildContractResponse(savedContract);
}
```

### 2. Frontend WebSocket Connection

```typescript
// Frontend TypeScript example
import io from 'socket.io-client';

const socket = io('ws://localhost:3000/messaging', {
  auth: {
    token: 'your-firebase-jwt-token'
  }
});

// Listen for connection
socket.on('connected', (data) => {
  console.log('Connected to messaging:', data);
});

// Join a thread
socket.emit('joinThread', { threadId: 'thread-uuid' });

// Send a message
socket.emit('sendMessage', {
  threadId: 'thread-uuid',
  content: 'Hello there!'
});

// Listen for new messages
socket.on('newMessage', (message) => {
  console.log('New message:', message);
  // Update UI with new message
});

// Listen for typing indicators
socket.on('userTyping', (data) => {
  console.log(`User ${data.userId} is typing: ${data.isTyping}`);
});
```

### 3. REST API Usage

```typescript
// Send message via REST API (also broadcasts via WebSocket)
const response = await fetch('/messaging/threads/123/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-firebase-token'
  },
  body: JSON.stringify({
    content: 'Hello from REST API!'
  })
});

// Get thread messages with pagination
const messages = await fetch('/messaging/threads/123/messages?page=1&limit=20');
```

## Security Features

1. **Firebase Authentication**: Both REST and WebSocket require valid Firebase tokens
2. **Thread Access Control**: Users can only access threads they're part of
3. **Role-based Messaging**: Automatic sender type detection based on user role
4. **Input Validation**: All inputs are validated before processing

## Real-time Features

1. **Live Messaging**: Messages appear instantly for all thread participants
2. **Typing Indicators**: Shows when users are typing
3. **Read Receipts**: Real-time read status updates
4. **Online Status**: Track which users are currently connected
5. **Notifications**: Can send targeted notifications to specific users

## Scalability Considerations

1. **Room-based Architecture**: Users only receive messages from threads they've joined
2. **Efficient Queries**: Pagination and optimized database queries
3. **Connection Management**: Automatic cleanup on disconnect
4. **Memory Management**: Efficient typing indicator cleanup

## Future Enhancements

1. **File Attachments**: Extend message content to support file uploads
2. **Message Reactions**: Add emoji reactions to messages
3. **Thread Archiving**: Archive old conversations
4. **Push Notifications**: Integration with mobile push notifications
5. **Message Search**: Full-text search across conversations
6. **AI Moderation**: Automatic content moderation
7. **Voice Messages**: Support for audio messages

## Error Handling

The system includes comprehensive error handling:
- Invalid tokens result in disconnection
- Access denied for unauthorized threads
- Graceful fallback to REST API if WebSocket fails
- Automatic reconnection on network issues

## Testing

### WebSocket Testing with Postman or Socket.io Client
1. Connect to `ws://localhost:3000/messaging`
2. Include `auth.token` in connection handshake
3. Test all events listed above

### REST API Testing
All endpoints are protected by Firebase auth middleware and can be tested with standard HTTP clients.

## Frontend Integration Checklist

### Required Dependencies
```bash
npm install socket.io-client
```

### Environment Variables
```typescript
// Frontend environment config
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3000/messaging';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
```

### Complete Frontend Implementation Example

```typescript
// messaging.service.ts
import io, { Socket } from 'socket.io-client';

// Import the exact interfaces from above
interface MessageResponse {
  id: string;
  threadId: string;
  senderId: string;
  senderType: 'ADVERTISER' | 'PROMOTER' | 'ADMIN' | 'SYSTEM';
  content: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: string;
    firebaseUid: string;
    username: string;
    profilePictureUrl?: string;
  };
}

interface MessageThreadResponse {
  id: string;
  campaignId: string;
  promoterId: string;
  advertiserId: string;
  subject?: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  campaign?: {
    id: string;
    title: string;
    isPublic: boolean;
  };
  promoter?: {
    id: string;
    firebaseUid: string;
    username: string;
    profilePictureUrl?: string;
  };
  advertiser?: {
    id: string;
    firebaseUid: string;
    username: string;
    profilePictureUrl?: string;
  };
  unreadCount?: number;
  messages?: MessageResponse[];
}

// WebSocket Event Interfaces
interface ConnectedPayload {
  userId: string;
  role: 'ADVERTISER' | 'PROMOTER' | 'ADMIN';
  message: string;
}

interface UserTypingPayload {
  threadId: string;
  userId: string;
  isTyping: boolean;
}

interface MessageReadPayload {
  messageId: string;
  userId: string;
}

interface ThreadReadPayload {
  threadId: string;
  userId: string;
}

class MessagingService {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(firebaseToken: string) {
    this.token = firebaseToken;
    this.socket = io('ws://localhost:3000/messaging', {
      auth: { token: firebaseToken }
    });

    this.socket.on('connected', (data: ConnectedPayload) => {
      console.log('✅ Connected to messaging:', data);
    });

    this.socket.on('error', (error: { message: string; code?: string }) => {
      console.error('❌ WebSocket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // REST API Methods
  async getThreads(page?: number, limit?: number, campaignId?: string): Promise<MessageThreadResponse[]> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (campaignId) params.append('campaignId', campaignId);

    const response = await fetch(`/messaging/threads?${params}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }

  async getMessages(threadId: string, page?: number, limit?: number): Promise<MessageResponse[]> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());

    const response = await fetch(`/messaging/threads/${threadId}/messages?${params}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }

  async createThread(campaignId: string, promoterId: string, advertiserId: string, subject?: string): Promise<MessageThreadResponse> {
    const response = await fetch('/messaging/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        campaignId,
        promoterId,
        advertiserId,
        subject
      })
    });
    return response.json();
  }

  // WebSocket Methods
  joinThread(threadId: string) {
    this.socket?.emit('joinThread', { threadId });
  }

  leaveThread(threadId: string) {
    this.socket?.emit('leaveThread', { threadId });
  }

  sendMessage(threadId: string, content: string) {
    this.socket?.emit('sendMessage', { threadId, content });
  }

  // Send message via REST API (also broadcasts via WebSocket)
  async sendMessageHTTP(threadId: string, content: string): Promise<MessageResponse> {
    const response = await fetch(`/messaging/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ content })
    });
    return response.json();
  }

  // Event Listeners
  onNewMessage(callback: (message: MessageResponse) => void) {
    this.socket?.on('newMessage', callback);
  }

  onUserTyping(callback: (data: UserTypingPayload) => void) {
    this.socket?.on('userTyping', callback);
  }

  onMessageRead(callback: (data: MessageReadPayload) => void) {
    this.socket?.on('messageRead', callback);
  }

  onThreadRead(callback: (data: ThreadReadPayload) => void) {
    this.socket?.on('threadRead', callback);
  }

  // Send typing indicator
  sendTyping(threadId: string, isTyping: boolean) {
    this.socket?.emit('typing', { threadId, isTyping });
  }

  // Mark as read
  markAsRead(threadId: string) {
    this.socket?.emit('markAsRead', { threadId });
  }

  markMessageAsRead(messageId: string, threadId: string) {
    this.socket?.emit('markAsRead', { messageId });
  }
}

export const messagingService = new MessagingService();
```

### React Hook Example

```typescript
// useMessaging.hook.ts
import { useEffect, useState } from 'react';
import { messagingService } from './messaging.service';

// Use the same interfaces as defined above
interface MessageResponse {
  id: string;
  threadId: string;
  senderId: string;
  senderType: 'ADVERTISER' | 'PROMOTER' | 'ADMIN' | 'SYSTEM';
  content: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: string;
    firebaseUid: string;
    username: string;
    profilePictureUrl?: string;
  };
}

interface MessageThreadResponse {
  id: string;
  campaignId: string;
  promoterId: string;
  advertiserId: string;
  subject?: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
  messages?: MessageResponse[];
}

export const useMessaging = (firebaseToken: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [threads, setThreads] = useState<MessageThreadResponse[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!firebaseToken) return;

    const socket = messagingService.connect(firebaseToken);

    socket.on('connected', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Listen for new messages
    messagingService.onNewMessage((message: MessageResponse) => {
      setMessages(prev => [...prev, message]);
      
      // Update thread's last message
      setThreads(prev => prev.map(thread => 
        thread.id === message.threadId 
          ? { ...thread, lastMessageAt: message.createdAt, messages: [message] }
          : thread
      ));
    });

    // Listen for typing indicators
    messagingService.onUserTyping(({ userId, isTyping }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (isTyping) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    });

    // Listen for read receipts
    messagingService.onMessageRead(({ messageId }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, isRead: true } : msg
      ));
    });

    messagingService.onThreadRead(({ threadId, userId }) => {
      setMessages(prev => prev.map(msg => 
        msg.threadId === threadId && msg.senderId !== userId 
          ? { ...msg, isRead: true } 
          : msg
      ));
    });

    return () => {
      messagingService.disconnect();
      setIsConnected(false);
    };
  }, [firebaseToken]);

  // Helper methods
  const loadThreads = async (page?: number, limit?: number, campaignId?: string) => {
    try {
      const threadsData = await messagingService.getThreads(page, limit, campaignId);
      setThreads(threadsData);
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  };

  const loadMessages = async (threadId: string, page?: number, limit?: number) => {
    try {
      const messagesData = await messagingService.getMessages(threadId, page, limit);
      setMessages(messagesData);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const createThread = async (campaignId: string, promoterId: string, advertiserId: string, subject?: string) => {
    try {
      const newThread = await messagingService.createThread(campaignId, promoterId, advertiserId, subject);
      setThreads(prev => [newThread, ...prev]);
      return newThread;
    } catch (error) {
      console.error('Failed to create thread:', error);
      throw error;
    }
  };

  return {
    // State
    isConnected,
    messages,
    threads,
    typingUsers,
    
    // WebSocket methods
    sendMessage: messagingService.sendMessage.bind(messagingService),
    joinThread: messagingService.joinThread.bind(messagingService),
    leaveThread: messagingService.leaveThread.bind(messagingService),
    sendTyping: messagingService.sendTyping.bind(messagingService),
    markAsRead: messagingService.markAsRead.bind(messagingService),
    
    // REST API methods
    loadThreads,
    loadMessages,
    createThread,
    sendMessageHTTP: messagingService.sendMessageHTTP.bind(messagingService)
  };
};
```

### React Component Example

```tsx
// MessageThread.tsx
import React, { useState, useEffect } from 'react';
import { useMessaging } from './useMessaging.hook';

interface Props {
  threadId: string;
  firebaseToken: string;
}

export const MessageThread: React.FC<Props> = ({ threadId, firebaseToken }) => {
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const { 
    isConnected, 
    messages, 
    typingUsers, 
    sendMessage, 
    joinThread, 
    sendTyping,
    markAsRead 
  } = useMessaging(firebaseToken);

  useEffect(() => {
    if (isConnected && threadId) {
      joinThread(threadId);
      markAsRead(threadId); // Mark as read when opening thread
    }
  }, [isConnected, threadId]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      sendMessage(threadId, newMessage);
      setNewMessage('');
      setIsTyping(false);
      sendTyping(threadId, false);
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    if (value && !isTyping) {
      setIsTyping(true);
      sendTyping(threadId, true);
    } else if (!value && isTyping) {
      setIsTyping(false);
      sendTyping(threadId, false);
    }
  };

  return (
    <div className="message-thread">
      <div className="connection-status">
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className="message">
            <strong>{message.sender?.username}:</strong> {message.content}
          </div>
        ))}
      </div>

      {typingUsers.size > 0 && (
        <div className="typing-indicator">
          Someone is typing...
        </div>
      )}

      <div className="message-input">
        <input
          value={newMessage}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};
```

## Quick Start for Frontend

1. **Install dependencies**: `npm install socket.io-client`
2. **Copy the service and hook code above**
3. **Get Firebase token** from your auth system
4. **Initialize messaging** in your app:

```typescript
// In your main app component
useEffect(() => {
  if (firebaseToken) {
    messagingService.connect(firebaseToken);
  }
}, [firebaseToken]);
```

5. **Create threads via REST API** first, then use WebSocket for real-time messaging
6. **Test with browser console** to verify WebSocket events are working

## Production Considerations

- **Reconnection Logic**: Handle network disconnections gracefully
- **Message Persistence**: Store messages locally during offline periods
- **Error Boundaries**: Wrap messaging components in error boundaries
- **Performance**: Implement message virtualization for large conversations
- **Security**: Validate all incoming WebSocket data on the frontend
