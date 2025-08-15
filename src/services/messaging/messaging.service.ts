import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageThread, Message } from '../../database/entities/message.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { User } from '../../interfaces/user';
import {
  CreateMessageThreadRequest,
  CreateMessageRequest,
  MessageResponse,
  MessageThreadResponse,
  GetMessagesRequest,
  GetThreadsRequest,
  MarkMessageAsReadRequest,
  MarkThreadAsReadRequest,
} from '../../interfaces/messaging';
import {
  NotificationDeliveryService,
  NotificationDeliveryData,
} from '../notification-delivery.service';
import { NotificationHelperService } from '../notification-helper.service';
import { NotificationType } from '../../enums/notification-type';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(MessageThread)
    private messageThreadRepository: Repository<MessageThread>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(CampaignEntity)
    private campaignRepository: Repository<CampaignEntity>,
    private readonly notificationHelperService: NotificationHelperService,
    private readonly notificationDeliveryService: NotificationDeliveryService,
  ) {}

  async getUserIdByFirebaseUid(firebaseUid: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
    });

    if (!user) {
      throw new Error(`User not found for Firebase UID: ${firebaseUid}`);
    }

    return user.id;
  }

  async createThread(
    request: CreateMessageThreadRequest,
    user: User,
  ): Promise<MessageThreadResponse> {
    // First, get the campaign to extract advertiser ID and check promoter campaigns
    const campaign = await this.campaignRepository.findOne({
      where: { id: request.campaignId },
      relations: ['advertiser', 'promoterCampaigns'],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    let promoterId: string;
    let advertiserId: string;

    // Determine promoterId and advertiserId based on user role
    if (user.role === 'ADVERTISER') {
      // If user is advertiser, make sure they own the campaign
      if (campaign.advertiserId !== user.id) {
        throw new BadRequestException(
          'You are not the advertiser for this campaign',
        );
      }

      // Get the first promoter from the campaign's promoterCampaigns
      if (
        !campaign.promoterCampaigns ||
        campaign.promoterCampaigns.length === 0
      ) {
        throw new BadRequestException('No promoters found for this campaign');
      }

      promoterId = campaign.promoterCampaigns[0].promoterId;
      advertiserId = user.id;
    } else if (user.role === 'PROMOTER') {
      // If user is promoter, make sure they are part of this campaign
      const promoterCampaign = campaign.promoterCampaigns?.find(
        (pc) => pc.promoterId === user.id,
      );

      if (!promoterCampaign) {
        throw new BadRequestException(
          'You are not a promoter for this campaign',
        );
      }

      promoterId = user.id;
      advertiserId = campaign.advertiserId;
    } else {
      throw new BadRequestException(
        'Invalid user role. Only advertisers and promoters can create threads',
      );
    }

    // Check if thread already exists
    const existingThread = await this.messageThreadRepository.findOne({
      where: {
        campaignId: request.campaignId,
        promoterId: promoterId,
        advertiserId: advertiserId,
      },
    });

    if (existingThread) {
      throw new BadRequestException(
        'Thread already exists for this campaign and users',
      );
    }

    const thread = this.messageThreadRepository.create({
      campaignId: request.campaignId,
      promoterId: promoterId,
      advertiserId: advertiserId,
      subject: request.subject || campaign.title, // Use campaign title as default subject
    });

    const savedThread = await this.messageThreadRepository.save(thread);

    // Notify the other participant about the new conversation thread
    try {
      const recipientId = user.id === promoterId ? advertiserId : promoterId;
      await this.sendNewConversationNotification(
        savedThread,
        user,
        recipientId,
        campaign,
      );
    } catch (error) {
      console.error('Failed to send new conversation notification:', error);
      // Don't throw error - thread creation was successful, notification is a bonus feature
    }

    return this.mapThreadToResponse(savedThread);
  }

  async sendMessage(
    senderId: string,
    request: CreateMessageRequest,
  ): Promise<MessageResponse> {
    // Validate thread exists and user has access
    const thread = await this.messageThreadRepository.findOne({
      where: { id: request.threadId },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // Validate user has access to this thread
    if (thread.promoterId !== senderId && thread.advertiserId !== senderId) {
      throw new BadRequestException('You do not have access to this thread');
    }

    const message = this.messageRepository.create({
      threadId: request.threadId,
      senderId,
      senderType: request.senderType,
      content: request.content,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update thread's lastMessageAt
    await this.messageThreadRepository.update(request.threadId, {
      lastMessageAt: new Date(),
    });

    return this.mapMessageToResponse(savedMessage);
  }

  async getMessages(request: GetMessagesRequest): Promise<MessageResponse[]> {
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.threadId = :threadId', { threadId: request.threadId })
      .orderBy('message.createdAt', 'DESC');

    if (request.before) {
      queryBuilder.andWhere('message.createdAt < :before', {
        before: request.before,
      });
    }

    if (request.limit) {
      queryBuilder.limit(request.limit);
    }

    if (request.page && request.limit) {
      queryBuilder.offset((request.page - 1) * request.limit);
    }

    const messages = await queryBuilder.getMany();

    return messages.map((message) => this.mapMessageToResponse(message));
  }

  async getThreads(
    request: GetThreadsRequest,
  ): Promise<MessageThreadResponse[]> {
    const queryBuilder = this.messageThreadRepository
      .createQueryBuilder('thread')
      .leftJoinAndSelect('thread.campaign', 'campaign')
      .leftJoinAndSelect('thread.promoter', 'promoter')
      .leftJoinAndSelect('thread.advertiser', 'advertiser')
      .where('(thread.promoterId = :userId OR thread.advertiserId = :userId)', {
        userId: request.userId,
      });

    if (request.campaignId) {
      queryBuilder.andWhere('thread.campaignId = :campaignId', {
        campaignId: request.campaignId,
      });
    }

    queryBuilder.orderBy('thread.lastMessageAt', 'DESC');

    if (request.limit) {
      queryBuilder.limit(request.limit);
    }

    if (request.page && request.limit) {
      const offset = (request.page - 1) * request.limit;
      queryBuilder.offset(offset);
    }

    const threads = await queryBuilder.getMany();

    const threadsWithMessages = await Promise.all(
      threads.map(async (thread) => {
        const unreadCount = await this.getUnreadMessageCount(
          thread.id,
          request.userId,
        );
        const recentMessages = await this.getMessages({
          threadId: thread.id,
          limit: 1,
        });

        return {
          ...this.mapThreadToResponse(thread),
          unreadCount,
          messages: recentMessages,
        };
      }),
    );

    return threadsWithMessages;
  }

  async getUnreadMessageCount(
    threadId: string,
    userId: string,
  ): Promise<number> {
    return this.messageRepository
      .createQueryBuilder('message')
      .where('message.threadId = :threadId', { threadId })
      .andWhere('message.isRead = false')
      .andWhere('message.senderId != :userId', { userId })
      .getCount();
  }

  async markMessageAsRead(
    request: MarkMessageAsReadRequest,
    userId: string,
  ): Promise<void> {
    // Find the message and verify the user has access to it
    const message = await this.messageRepository.findOne({
      where: { id: request.messageId },
      relations: ['thread'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Get the thread to verify user access
    const thread = await this.messageThreadRepository.findOne({
      where: { id: message.threadId },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // Verify user has access to this thread
    if (thread.promoterId !== userId && thread.advertiserId !== userId) {
      throw new BadRequestException('You do not have access to this message');
    }

    // Only allow marking messages as read if they were not sent by the current user
    if (message.senderId === userId) {
      throw new BadRequestException(
        'You cannot mark your own messages as read',
      );
    }

    await this.messageRepository.update(request.messageId, { isRead: true });
  }

  async markThreadAsRead(request: MarkThreadAsReadRequest): Promise<void> {
    // Mark all messages in thread as read for the user (messages not sent by them)
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('thread_id = :threadId', { threadId: request.threadId })
      .andWhere('sender_id != :userId', { userId: request.userId })
      .execute();
  }

  async getThreadById(threadId: string): Promise<MessageThreadResponse> {
    const thread = await this.messageThreadRepository.findOne({
      where: { id: threadId },
      relations: ['campaign', 'promoter', 'advertiser'],
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return this.mapThreadToResponse(thread);
  }

  private async getThreadForCampaign(
    campaignId: string,
    promoterId: string,
    advertiserId: string,
  ): Promise<MessageThreadResponse | null> {
    const thread = await this.messageThreadRepository.findOne({
      where: {
        campaignId,
        promoterId,
        advertiserId,
      },
      relations: ['campaign', 'promoter', 'advertiser'],
    });

    return thread ? this.mapThreadToResponse(thread) : null;
  }

  async getThreadByCampaignAndUser(
    campaignId: string,
    userId: string,
  ): Promise<MessageThreadResponse | null> {
    // Try to find thread where user is either promoter or advertiser
    const thread = await this.messageThreadRepository
      .createQueryBuilder('thread')
      .leftJoinAndSelect('thread.campaign', 'campaign')
      .leftJoinAndSelect('thread.promoter', 'promoter')
      .leftJoinAndSelect('thread.advertiser', 'advertiser')
      .where('thread.campaignId = :campaignId', { campaignId })
      .andWhere(
        '(thread.promoterId = :userId OR thread.advertiserId = :userId)',
        { userId },
      )
      .getOne();

    return thread ? this.mapThreadToResponse(thread) : null;
  }

  async createThreadForPrivateCampaign(
    campaignId: string,
    promoterId: string,
  ): Promise<MessageThreadResponse> {
    // Get campaign to extract advertiser ID
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const advertiserId = campaign.advertiserId;

    // Check if thread already exists
    const existingThread = await this.getThreadForCampaign(
      campaignId,
      promoterId,
      advertiserId,
    );

    if (existingThread) {
      return existingThread;
    }

    // Create new thread directly (old logic for private campaigns)
    const thread = this.messageThreadRepository.create({
      campaignId,
      promoterId,
      advertiserId,
      subject: campaign.title, // Use campaign title as default subject
    });

    const savedThread = await this.messageThreadRepository.save(thread);

    return this.mapThreadToResponse(savedThread);
  }

  // Helper methods for mapping entities to response DTOs
  private mapMessageToResponse(message: Message): MessageResponse {
    return {
      id: message.id,
      threadId: message.threadId,
      senderId: message.senderId,
      senderType: message.senderType,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: message.sender
        ? {
            id: message.sender.id,
            username: message.sender.name,
            profilePictureUrl: message.sender.avatarUrl,
          }
        : undefined,
    };
  }

  private mapThreadToResponse(thread: MessageThread): MessageThreadResponse {
    return {
      id: thread.id,
      campaignId: thread.campaignId,
      promoterId: thread.promoterId,
      advertiserId: thread.advertiserId,
      subject: thread.subject,
      lastMessageAt: thread.lastMessageAt,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      campaign: thread.campaign
        ? {
            id: thread.campaign.id,
            title: thread.campaign.title,
            isPublic: thread.campaign.isPublic,
          }
        : undefined,
      promoter: thread.promoter
        ? {
            id: thread.promoter.id,
            username: thread.promoter.name,
            profilePictureUrl: thread.promoter.avatarUrl,
          }
        : undefined,
      advertiser: thread.advertiser
        ? {
            id: thread.advertiser.id,
            username: thread.advertiser.name,
            profilePictureUrl: thread.advertiser.avatarUrl,
          }
        : undefined,
    };
  }

  async getNewMessagesStatusForCampaign(
    campaignId: string,
    userId: string,
  ): Promise<{ hasNewMessages: boolean; unreadCount: number }> {
    try {
      // First, find the thread for this campaign and user
      const thread = await this.getThreadByCampaignAndUser(campaignId, userId);

      if (!thread) {
        // No thread exists for this campaign and user, so no new messages
        return { hasNewMessages: false, unreadCount: 0 };
      }

      // Get the unread message count for this thread
      const unreadCount = await this.getUnreadMessageCount(thread.id, userId);

      return {
        hasNewMessages: unreadCount > 0,
        unreadCount,
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === '22P02') {
        throw new BadRequestException(
          `Invalid campaign ID format: ${campaignId}. Expected UUID format.`,
        );
      }
      throw error;
    }
  }

  /**
   * Send notification to the other participant when a new conversation thread is created
   */
  private async sendNewConversationNotification(
    thread: MessageThread,
    creator: User,
    recipientId: string,
    campaign: CampaignEntity,
  ): Promise<void> {
    // Get notification delivery methods for the recipient
    const deliveryMethods =
      await this.notificationHelperService.getNotificationMethods(
        recipientId,
        NotificationType.NEW_CONVERSATION,
      );

    if (deliveryMethods.length === 0) {
      return; // User has disabled notifications for new conversations
    }

    // Prepare notification data
    const notificationData: NotificationDeliveryData = {
      userId: recipientId,
      notificationType: NotificationType.NEW_CONVERSATION,
      title: '💬 New Conversation Started!',
      message: `${creator.name || creator.email} started a new conversation about "${campaign.title}"`,
      deliveryMethods,
      metadata: {
        threadId: thread.id,
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        creatorName: creator.name || creator.email || 'Someone',
        creatorRole: creator.role,
        subject: thread.subject,
        createdAt: thread.createdAt,
      },
      campaignId: campaign.id,
      conversationId: thread.id,
    };

    // Send notifications
    try {
      await this.notificationDeliveryService.deliverNotification(
        notificationData,
      );
    } catch (error) {
      console.error('Failed to send new conversation notification:', error);
      // Don't throw error - thread creation was successful, notification is a bonus feature
    }
  }
}
