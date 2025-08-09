import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Logger,
} from '@nestjs/common';
import { MessagingService } from '../services/messaging/messaging.service';
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

@Controller('messaging')
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  @Post('threads')
  async createThread(
    @Body() request: CreateMessageThreadRequest,
  ): Promise<MessageThreadResponse> {
    return this.messagingService.createThread(request);
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
    return this.messagingService.getThreadByCampaignAndUser(campaignId, userId);
  }

  @Get('threads/:threadId')
  async getThread(
    @Param('threadId') threadId: string,
  ): Promise<MessageThreadResponse> {
    return this.messagingService.getThreadById(threadId);
  }

  @Post('threads/:threadId/messages')
  async sendMessage(
    @Param('threadId') threadId: string,
    @Body() body: { content: string },
    @User('uid') firebaseUid: string,
    @User('role') userRole: UserType,
  ): Promise<MessageResponse> {
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
    this.logger.log(`Determining sender type for user ${userId} with role: ${userRole}`);
    let senderType: MessageSenderType;
    switch (userRole) {
      case UserType.ADVERTISER:
        senderType = MessageSenderType.ADVERTISER;
        break;
      case UserType.PROMOTER:
        senderType = MessageSenderType.PROMOTER;
        break;
      default:
        this.logger.error(`Invalid user role for messaging: ${String(userRole)}. Expected PROMOTER or ADVERTISER.`);
        throw new Error(`Invalid user role: ${String(userRole)}. Only PROMOTER and ADVERTISER can send messages.`);
    }

    const request: CreateMessageRequest = {
      threadId,
      content: body.content,
      senderType,
    };

    const message = await this.messagingService.sendMessage(userId, request);

    // Automatically mark the thread as read for the sender since they're actively participating
    try {
      this.logger.log(`Automatically marking thread ${threadId} as read for sender ${userId}`);
      const markAsReadRequest: MarkThreadAsReadRequest = { threadId, userId };
      await this.messagingService.markThreadAsRead(markAsReadRequest);
      this.logger.log(`Successfully marked thread ${threadId} as read for sender ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to automatically mark thread ${threadId} as read for sender ${userId}:`, error);
      // Don't throw error - the message was sent successfully, read marking is a bonus feature
    }

    // Get thread participants to broadcast only to recipients (not sender)
    const thread = await this.messagingService.getThreadById(threadId);

    // Broadcast to recipients only (exclude sender)
    const recipientIds = [thread.promoterId, thread.advertiserId].filter(
      (id) => id !== userId,
    );

    recipientIds.forEach((recipientId) => {
      // Emit to all sockets belonging to each recipient
      this.messagingGateway.server
        .to(`user_${recipientId}`)
        .emit('newMessage', message);
    });

    this.logger.log(`Message sent via REST API - Thread: ${threadId}, Sender: ${userId}, Recipients: [${recipientIds.join(', ')}]`);

    return message;
  }

  @Get('threads/:threadId/messages')
  async getMessages(
    @Param('threadId') threadId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ): Promise<MessageResponse[]> {
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
    if (!firebaseUid) {
      throw new Error('User not authenticated - Firebase UID is required');
    }

    const userId =
      await this.messagingService.getUserIdByFirebaseUid(firebaseUid);

    if (!userId) {
      throw new Error('Unable to resolve database user ID from Firebase UID');
    }

    const request: MarkThreadAsReadRequest = { threadId, userId };
    await this.messagingService.markThreadAsRead(request);

    // Broadcast thread read status only to message senders, not to the reader
    const thread = await this.messagingService.getThreadById(threadId);
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
  }
}
