import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MessagingService } from '../services/messaging/messaging.service';
import { FirebaseAuthService } from '../services/firebase-auth.service';
import { UserService } from '../services/user.service';
import {
  CreateMessageRequest,
  MarkMessageAsReadRequest,
  MarkThreadAsReadRequest,
} from '../interfaces/messaging';
import { MessageSenderType } from '../enums/message-sender-type';
import { UserType } from '../enums/user-type';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: UserType;
  firebaseUid?: string;
}

interface JoinThreadPayload {
  threadId: string;
}

interface SendMessagePayload {
  threadId: string;
  content: string;
}

interface MarkAsReadPayload {
  threadId?: string;
  messageId?: string;
}

interface TypingPayload {
  threadId: string;
  isTyping: boolean;
}

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this properly for production
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/messaging',
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  private readonly connectedUsers = new Map<string, AuthenticatedSocket>();
  private readonly typingUsers = new Map<string, Set<string>>(); // threadId -> Set of userIds

  constructor(
    private readonly messagingService: MessagingService,
    private readonly firebaseAuthService: FirebaseAuthService,
    private readonly userService: UserService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      this.logger.log(`Client attempting to connect: ${client.id}`);

      // Extract token from handshake auth
      const token = (client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace(
          'Bearer ',
          '',
        )) as string;

      if (!token) {
        this.logger.warn(`No token provided for client: ${client.id}`);
        client.disconnect();
        return;
      }

      // Verify Firebase token
      const firebaseUser = await this.firebaseAuthService.verifyIdToken(token);
      if (!firebaseUser) {
        this.logger.warn(`Invalid token for client: ${client.id}`);
        client.disconnect();
        return;
      }

      // Get user from database
      const user = await this.userService.getUserByFirebaseUid(
        firebaseUser.uid,
      );
      if (!user) {
        this.logger.warn(
          `User not found for Firebase UID: ${firebaseUser.uid}`,
        );
        client.disconnect();
        return;
      }

      // Attach user info to socket
      client.userId = user.id;
      client.userRole = user.role as UserType;
      client.firebaseUid = firebaseUser.uid;

      // Store connected user
      this.connectedUsers.set(user.id, client);

      this.logger.log(`User connected: ${user.id} (${user.role})`);

      // Join user to their personal room for notifications
      await client.join(`user_${user.id}`);

      // Emit connection success
      client.emit('connected', {
        userId: user.id,
        role: user.role,
        message: 'Connected to messaging',
      });
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.connectedUsers.delete(client.userId);

      // Remove from typing indicators
      this.typingUsers.forEach((userSet, threadId) => {
        if (userSet.has(client.userId!)) {
          userSet.delete(client.userId!);
          this.broadcastTypingStatus(threadId, client.userId!, false);

          if (userSet.size === 0) {
            this.typingUsers.delete(threadId);
          }
        }
      });

      this.logger.log(`User disconnected: ${client.userId}`);
    }
  }

  @SubscribeMessage('joinThread')
  async handleJoinThread(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinThreadPayload,
  ) {
    try {
      if (!client.userId) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Verify user has access to this thread
      const thread = await this.messagingService.getThreadById(
        payload.threadId,
      );
      if (
        thread.promoterId !== client.userId &&
        thread.advertiserId !== client.userId
      ) {
        client.emit('error', { message: 'Access denied to this thread' });
        return;
      }

      // Join the thread room
      await client.join(`thread_${payload.threadId}`);

      this.logger.log(
        `User ${client.userId} joined thread ${payload.threadId}`,
      );

      client.emit('threadJoined', { threadId: payload.threadId });
    } catch (error) {
      this.logger.error(`Error joining thread:`, error);
      client.emit('error', { message: 'Failed to join thread' });
    }
  }

  @SubscribeMessage('leaveThread')
  handleLeaveThread(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinThreadPayload,
  ) {
    void client.leave(`thread_${payload.threadId}`);

    // Remove from typing indicators
    const typingSet = this.typingUsers.get(payload.threadId);
    if (typingSet && typingSet.has(client.userId!)) {
      typingSet.delete(client.userId!);
      this.broadcastTypingStatus(payload.threadId, client.userId!, false);
    }

    client.emit('threadLeft', { threadId: payload.threadId });
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    try {
      if (!client.userId || !client.userRole) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Determine sender type based on user role
      this.logger.log(`[WebSocket] Determining sender type for user ${client.userId} with role: ${client.userRole}`);
      let senderType: MessageSenderType;
      switch (client.userRole) {
        case UserType.ADVERTISER:
          senderType = MessageSenderType.ADVERTISER;
          break;
        case UserType.PROMOTER:
          senderType = MessageSenderType.PROMOTER;
          break;
        default:
          this.logger.error(`[WebSocket] Invalid user role for messaging: ${String(client.userRole)}. Expected PROMOTER or ADVERTISER.`);
          client.emit('error', { message: `Invalid user role: ${String(client.userRole)}. Only PROMOTER and ADVERTISER can send messages.` });
          return;
      }

      const request: CreateMessageRequest = {
        threadId: payload.threadId,
        content: payload.content,
        senderType,
      };

      // Save message using the messaging service
      const message = await this.messagingService.sendMessage(
        client.userId,
        request,
      );

      // Automatically mark the thread as read for the sender
      // (sending a message implies the user has seen previous unread messages)
      try {
        this.logger.log(`[WebSocket] Automatically marking thread ${payload.threadId} as read for sender ${client.userId}`);
        const markAsReadRequest = { threadId: payload.threadId, userId: client.userId };
        await this.messagingService.markThreadAsRead(markAsReadRequest);
        this.logger.log(`[WebSocket] Successfully marked thread ${payload.threadId} as read for sender ${client.userId}`);
      } catch (error) {
        this.logger.error(`[WebSocket] Failed to automatically mark thread ${payload.threadId} as read for sender ${client.userId}:`, error);
        // Don't throw error - the message was sent successfully, read marking is a bonus feature
      }

      // Remove user from typing indicators
      const typingSet = this.typingUsers.get(payload.threadId);
      if (typingSet && typingSet.has(client.userId)) {
        typingSet.delete(client.userId);
        this.broadcastTypingStatus(payload.threadId, client.userId, false);
      }

      // Broadcast the new message only to recipients (not sender)
      const thread = await this.messagingService.getThreadById(
        payload.threadId,
      );
      const recipientIds = [thread.promoterId, thread.advertiserId].filter(
        (id) => id !== client.userId,
      );

      recipientIds.forEach((recipientId) => {
        this.server.to(`user_${recipientId}`).emit('newMessage', message);
      });

      this.logger.log(
        `Message sent via WebSocket - Thread: ${payload.threadId}, Sender: ${client.userId}, Recipients: [${recipientIds.join(', ')}]`,
      );
    } catch (error) {
      this.logger.error(`Error sending message:`, error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkAsReadPayload,
  ) {
    try {
      if (!client.userId) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      if (payload.messageId) {
        // Mark single message as read
        const request: MarkMessageAsReadRequest = {
          messageId: payload.messageId,
        };
        await this.messagingService.markMessageAsRead(request, client.userId);

        // Get thread to broadcast only to recipients (not the reader)
        if (payload.threadId) {
          const thread = await this.messagingService.getThreadById(
            payload.threadId,
          );
          const recipientIds = [thread.promoterId, thread.advertiserId].filter(
            (id) => id !== client.userId,
          );

          recipientIds.forEach((recipientId) => {
            this.server.to(`user_${recipientId}`).emit('messageRead', {
              messageId: payload.messageId,
              userId: client.userId,
              threadId: payload.threadId,
            });
          });
        }
      } else if (payload.threadId) {
        // Mark entire thread as read
        const request: MarkThreadAsReadRequest = {
          threadId: payload.threadId,
          userId: client.userId,
        };
        await this.messagingService.markThreadAsRead(request);

        // Get thread to broadcast only to recipients (not the reader)
        const thread = await this.messagingService.getThreadById(
          payload.threadId,
        );
        const recipientIds = [thread.promoterId, thread.advertiserId].filter(
          (id) => id !== client.userId,
        );

        recipientIds.forEach((recipientId) => {
          this.server.to(`user_${recipientId}`).emit('threadRead', {
            threadId: payload.threadId,
            userId: client.userId,
          });
        });
      }
    } catch (error) {
      this.logger.error(`Error marking as read:`, error);
      client.emit('error', { message: 'Failed to mark as read' });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingPayload,
  ) {
    if (!client.userId) {
      return;
    }

    const threadId = payload.threadId;
    const userId = client.userId;

    // Get or create typing set for this thread
    if (!this.typingUsers.has(threadId)) {
      this.typingUsers.set(threadId, new Set());
    }
    const typingSet = this.typingUsers.get(threadId)!;

    if (payload.isTyping) {
      typingSet.add(userId);
    } else {
      typingSet.delete(userId);
    }

    // Broadcast typing status to other users in the thread
    this.broadcastTypingStatus(threadId, userId, payload.isTyping);
  }

  private broadcastTypingStatus(
    threadId: string,
    userId: string,
    isTyping: boolean,
  ) {
    // Broadcast to all users in the thread except the typing user
    this.server.to(`thread_${threadId}`).emit('userTyping', {
      threadId,
      userId,
      isTyping,
    });
  }

  // Method to broadcast notifications to specific users
  notifyUser(userId: string, notification: any) {
    const userSocket = this.connectedUsers.get(userId);
    if (userSocket) {
      userSocket.emit('notification', notification);
    }
  }

  // Method to get online status of users
  getUsersOnlineStatus(userIds: string[]): Map<string, boolean> {
    const onlineStatus = new Map<string, boolean>();
    userIds.forEach((userId) => {
      onlineStatus.set(userId, this.connectedUsers.has(userId));
    });
    return onlineStatus;
  }

  // Method to broadcast to all connected users
  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }
}
