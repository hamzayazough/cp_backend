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
  ): Promise<MessageThreadResponse> {
    // First, get the campaign to extract advertiser ID
    const campaign = await this.campaignRepository.findOne({
      where: { id: request.campaignId },
      relations: ['advertiser'],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const advertiserId = campaign.advertiserId;

    // Check if thread already exists
    const existingThread = await this.messageThreadRepository.findOne({
      where: {
        campaignId: request.campaignId,
        promoterId: request.promoterId,
        advertiserId: advertiserId,
      },
    });

    if (existingThread) {
      throw new BadRequestException(
        'Thread already exists for this campaign and users',
      );
    }

    // Validate that promoter exists
    const promoter = await this.userRepository.findOne({
      where: { id: request.promoterId },
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    const thread = this.messageThreadRepository.create({
      campaignId: request.campaignId,
      promoterId: request.promoterId,
      advertiserId: advertiserId,
      subject: request.subject || campaign.title, // Use campaign title as default subject
    });

    const savedThread = await this.messageThreadRepository.save(thread);

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
      .where('threadId = :threadId', { threadId: request.threadId })
      .andWhere('senderId != :userId', { userId: request.userId })
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

    // Create new thread for the private campaign
    const createRequest: CreateMessageThreadRequest = {
      campaignId,
      promoterId,
      // No subject specified - will use campaign title as default
    };

    return this.createThread(createRequest);
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
}
