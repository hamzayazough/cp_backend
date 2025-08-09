import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
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
    @User('id') userId: string,
    @User('role') userRole: UserType,
  ): Promise<MessageResponse> {
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
        senderType = MessageSenderType.SYSTEM;
    }

    const request: CreateMessageRequest = {
      threadId,
      content: body.content,
      senderType,
    };

    const message = await this.messagingService.sendMessage(userId, request);

    // Broadcast the message to WebSocket clients in real-time
    this.messagingGateway.server
      .to(`thread_${threadId}`)
      .emit('newMessage', message);

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
    @User('id') userId?: string,
  ): Promise<void> {
    const request: MarkMessageAsReadRequest = { messageId };
    await this.messagingService.markMessageAsRead(request);

    // Broadcast read status to WebSocket clients if threadId is provided
    if (threadId && userId) {
      this.messagingGateway.server
        .to(`thread_${threadId}`)
        .emit('messageRead', {
          messageId,
          userId,
        });
    }
  }

  @Patch('threads/:threadId/read')
  async markThreadAsRead(
    @Param('threadId') threadId: string,
    @User('id') userId: string,
  ): Promise<void> {
    const request: MarkThreadAsReadRequest = { threadId, userId };
    await this.messagingService.markThreadAsRead(request);

    // Broadcast thread read status to WebSocket clients
    this.messagingGateway.server.to(`thread_${threadId}`).emit('threadRead', {
      threadId,
      userId,
    });
  }
}
