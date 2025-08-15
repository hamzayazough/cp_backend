import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { MessagingService } from '../services/messaging/messaging.service';
import { UserService } from '../services/user.service';
import { MessagingGateway } from '../gateways/messaging.gateway';
import { User } from '../auth/user.decorator';
import {
  CreateMessageThreadRequest,
  CreateMessageRequest,
  MessageResponse,
  MessageThreadResponse,
  GetMessagesRequest,
  GetThreadsRequest,
  MarkMessageAsReadRequest,
  MarkThreadAsReadRequest,
} from '../interfaces/messaging';
import { MessageSenderType } from '../enums/message-sender-type';
import { UserType } from '../enums/user-type';
import {
  NotificationDeliveryService,
  NotificationDeliveryData,
} from '../services/notification-delivery.service';
import { NotificationHelperService } from '../services/notification-helper.service';
import { NotificationType } from '../enums/notification-type';

@Controller('messaging')
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);
  private readonly uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingGateway: MessagingGateway,
    private readonly userService: UserService,
    private readonly notificationHelperService: NotificationHelperService,
    private readonly notificationDeliveryService: NotificationDeliveryService,
  ) {}

  private validateUUID(id: string, paramName: string): void {
    if (!this.uuidRegex.test(id)) {
      throw new BadRequestException(
        `Invalid ${paramName} format. Expected UUID format, received: ${id}`,
      );
    }
  }

  @Post('threads')
  async createThread(
    @Body() request: CreateMessageThreadRequest,
    @User('uid') firebaseUid: string,
  ): Promise<MessageThreadResponse> {
    if (!firebaseUid) {
      throw new Error('User not authenticated - Firebase UID is required');
    }

    // Get the user entity using Firebase UID
    const user = await this.userService.getUserByFirebaseUid(firebaseUid);

    if (!user) {
      throw new Error('Unable to resolve user from Firebase UID');
    }

    return this.messagingService.createThread(request, user);
  }

  @Get('threads')
  async getThreads(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('campaignId') campaignId?: string,
    @User('uid') firebaseUid?: string,
  ): Promise<MessageThreadResponse[]> {
    if (!firebaseUid) {
      throw new Error('User not authenticated - Firebase UID is required');
    }

    // Validate campaignId if provided
    if (campaignId) {
      this.validateUUID(campaignId, 'campaign ID');
    }

    // Get the database user ID using Firebase UID
    const userId =
      await this.messagingService.getUserIdByFirebaseUid(firebaseUid);

    if (!userId) {
      throw new Error('Unable to resolve database user ID from Firebase UID');
    }

    const request: GetThreadsRequest = {
      userId: userId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      campaignId,
    };

    return this.messagingService.getThreads(request);
  }

  @Get('campaigns/:campaignId/thread')
  async getThreadByCampaign(
    @Param('campaignId') campaignId: string,
    @User('id') userId: string,
  ): Promise<MessageThreadResponse | null> {
    this.validateUUID(campaignId, 'campaign ID');
    return this.messagingService.getThreadByCampaignAndUser(campaignId, userId);
  }

  @Get('campaigns/:campaignId/has-new-messages')
  async hasNewMessagesForCampaign(
    @Param('campaignId') campaignId: string,
    @User('uid') firebaseUid: string,
  ): Promise<{ hasNewMessages: boolean; unreadCount: number }> {
    this.validateUUID(campaignId, 'campaign ID');

    if (!firebaseUid) {
      throw new Error('User not authenticated - Firebase UID is required');
    }

    // Get the database user ID using Firebase UID
    const userId =
      await this.messagingService.getUserIdByFirebaseUid(firebaseUid);

    if (!userId) {
      throw new Error('Unable to resolve database user ID from Firebase UID');
    }

    const result = await this.messagingService.getNewMessagesStatusForCampaign(
      campaignId,
      userId,
    );
    return result;
  }

  @Get('threads/:threadId')
  async getThread(
    @Param('threadId') threadId: string,
  ): Promise<MessageThreadResponse> {
    this.validateUUID(threadId, 'thread ID');
    return this.messagingService.getThreadById(threadId);
  }

  @Post('threads/:threadId/messages')
  async sendMessage(
    @Param('threadId') threadId: string,
    @Body() body: { content: string },
    @User('uid') firebaseUid: string,
    @User('role') userRole: UserType,
  ): Promise<MessageResponse> {
    this.validateUUID(threadId, 'thread ID');

    if (!firebaseUid) {
      throw new Error('User not authenticated - Firebase UID is required');
    }

    // Get the database user ID using Firebase UID
    const userId =
      await this.messagingService.getUserIdByFirebaseUid(firebaseUid);

    if (!userId) {
      throw new Error('Unable to resolve database user ID from Firebase UID');
    }

    // Determine sender type based on user role
    let senderType: MessageSenderType;
    switch (userRole) {
      case UserType.ADVERTISER:
        senderType = MessageSenderType.ADVERTISER;
        break;
      case UserType.PROMOTER:
        senderType = MessageSenderType.PROMOTER;
        break;
      default:
        throw new Error(
          `Invalid user role: ${String(userRole)}. Only PROMOTER and ADVERTISER can send messages.`,
        );
    }

    const request: CreateMessageRequest = {
      threadId,
      content: body.content,
      senderType,
    };

    const message = await this.messagingService.sendMessage(userId, request);

    // Automatically mark the thread as read for the sender since they're actively participating
    try {
      const markAsReadRequest: MarkThreadAsReadRequest = { threadId, userId };
      await this.messagingService.markThreadAsRead(markAsReadRequest);
    } catch {
      // Don't throw error - the message was sent successfully, read marking is a bonus feature
    }

    // Get thread participants to broadcast only to recipients (not sender)
    const thread = await this.messagingService.getThreadById(threadId);

    // Broadcast to recipients only (exclude sender)
    const recipientIds = [thread.promoterId, thread.advertiserId].filter(
      (id) => id !== userId,
    );

    // Check online status and handle notifications for offline users
    const onlineStatus =
      this.messagingGateway.getUsersOnlineStatus(recipientIds);

    for (const recipientId of recipientIds) {
      const isOnline = onlineStatus.get(recipientId);

      if (isOnline) {
        // User is online, send real-time message via WebSocket
        this.messagingGateway.server
          .to(`user_${recipientId}`)
          .emit('newMessage', message);
      } else {
        // User is offline, send notification
        try {
          await this.sendOfflineMessageNotification(
            recipientId,
            message,
            thread,
            userId,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send notification to offline user ${recipientId}:`,
            error,
          );
          // Don't throw error - continue processing
        }
      }
    }

    return message;
  }

  @Get('threads/:threadId/messages')
  async getMessages(
    @Param('threadId') threadId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ): Promise<MessageResponse[]> {
    this.validateUUID(threadId, 'thread ID');

    const request: GetMessagesRequest = {
      threadId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      before: before ? new Date(before) : undefined,
    };
    return this.messagingService.getMessages(request);
  }

  @Patch('messages/:messageId/read')
  async markMessageAsRead(
    @Param('messageId') messageId: string,
    @Query('threadId') threadId?: string,
    @User('uid') firebaseUid?: string,
  ): Promise<void> {
    this.validateUUID(messageId, 'message ID');
    if (threadId) {
      this.validateUUID(threadId, 'thread ID');
    }

    if (!firebaseUid) {
      throw new Error('User not authenticated - Firebase UID is required');
    }

    const userId =
      await this.messagingService.getUserIdByFirebaseUid(firebaseUid);

    if (!userId) {
      throw new Error('Unable to resolve database user ID from Firebase UID');
    }

    const request: MarkMessageAsReadRequest = { messageId };
    await this.messagingService.markMessageAsRead(request, userId);

    // Broadcast read status only to message sender, not to the reader
    if (threadId) {
      const thread = await this.messagingService.getThreadById(threadId);
      const recipientIds = [thread.promoterId, thread.advertiserId].filter(
        (id) => id !== userId,
      );

      recipientIds.forEach((recipientId) => {
        this.messagingGateway.server
          .to(`user_${recipientId}`)
          .emit('messageRead', {
            messageId,
            userId,
            threadId,
          });
      });
    }
  }

  @Patch('threads/:threadId/read')
  async markThreadAsRead(
    @Param('threadId') threadId: string,
    @User('uid') firebaseUid: string,
  ): Promise<void> {
    this.validateUUID(threadId, 'thread ID');

    if (!firebaseUid) {
      throw new Error('User not authenticated - Firebase UID is required');
    }

    const userId =
      await this.messagingService.getUserIdByFirebaseUid(firebaseUid);

    if (!userId) {
      throw new Error('Unable to resolve database user ID from Firebase UID');
    }

    // Verify user has access to this thread
    const thread = await this.messagingService.getThreadById(threadId);
    if (thread.promoterId !== userId && thread.advertiserId !== userId) {
      throw new Error('Access denied: User does not belong to this thread');
    }

    const request: MarkThreadAsReadRequest = { threadId, userId };
    await this.messagingService.markThreadAsRead(request);

    // Get unread count after marking as read
    const unreadCountAfter = await this.messagingService.getUnreadMessageCount(
      threadId,
      userId,
    );

    // Broadcast thread read status only to message senders, not to the reader
    const recipientIds = [thread.promoterId, thread.advertiserId].filter(
      (id) => id !== userId,
    );

    recipientIds.forEach((recipientId) => {
      this.messagingGateway.server
        .to(`user_${recipientId}`)
        .emit('threadRead', {
          threadId,
          userId,
        });
    });

    // Also notify the current user with updated thread information including new unread count
    this.messagingGateway.server.to(`user_${userId}`).emit('threadUpdated', {
      threadId,
      unreadCount: unreadCountAfter,
      action: 'marked_as_read',
    });
  }

  /**
   * Send notification to offline users when they receive a new message
   */
  private async sendOfflineMessageNotification(
    recipientId: string,
    message: MessageResponse,
    thread: MessageThreadResponse,
    senderId: string,
  ): Promise<void> {
    try {
      // Get notification delivery methods for the recipient
      const deliveryMethods =
        await this.notificationHelperService.getNotificationMethods(
          recipientId,
          NotificationType.NEW_MESSAGE,
        );

      if (deliveryMethods.length === 0) {
        return; // User has disabled notifications for new messages
      }

      // Get sender information
      const sender = await this.userService.getUserById(senderId);
      if (!sender) {
        this.logger.error(`Sender not found: ${senderId}`);
        return;
      }

      // Use campaign title from thread if available, otherwise use fallback
      const campaignTitle = thread.campaign?.title || 'Campaign';

      // Prepare notification data
      const notificationData: NotificationDeliveryData = {
        userId: recipientId,
        notificationType: NotificationType.NEW_MESSAGE,
        title: '💬 New Message!',
        message: `${sender.name || sender.email} sent you a message about "${campaignTitle}"`,
        deliveryMethods,
        metadata: {
          messageId: message.id,
          threadId: thread.id,
          campaignId: thread.campaignId,
          campaignTitle,
          senderName: sender.name || sender.email || 'Someone',
          senderRole: sender.role,
          messageContent:
            message.content && message.content.length > 100
              ? `${message.content.substring(0, 100)}...`
              : message.content || '',
          sentAt: message.createdAt,
        },
        campaignId: thread.campaignId,
        conversationId: thread.id,
      };

      // Send notifications
      await this.notificationDeliveryService.deliverNotification(
        notificationData,
      );
    } catch (error) {
      this.logger.error(`Error sending offline message notification:`, error);
      throw error;
    }
  }
}
