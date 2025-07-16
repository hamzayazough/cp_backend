import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageThread, Message } from '../database/entities/message.entity';
import { AdvertiserMessage } from '../interfaces/advertiser-dashboard';

@Injectable()
export class AdvertiserMessageService {
  constructor(
    @InjectRepository(MessageThread)
    private messageThreadRepository: Repository<MessageThread>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async getRecentMessages(
    advertiserId: number,
    limit: number = 10,
  ): Promise<AdvertiserMessage[]> {
    const messages = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.thread', 'thread')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('thread.advertiserId = :advertiserId', { advertiserId })
      .orderBy('message.createdAt', 'DESC')
      .limit(limit)
      .getMany();
    return messages.map((message) => ({
      id: message.id,
      name: message.sender?.name || 'Unknown',
      message: message.content,
      time: message.createdAt.toISOString(),
      avatar: message.sender?.avatarUrl || undefined,
      isRead: message.isRead || false,
      threadId: message.thread.id,
      senderType: message.senderType as 'PROMOTER' | 'ADMIN' | 'SYSTEM',
      campaignId: message.thread.campaignId,
    }));
  }
}
