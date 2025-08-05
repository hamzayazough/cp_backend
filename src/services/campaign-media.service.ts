import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignMedia } from '../database/entities/campaign-media.entity';

@Injectable()
export class CampaignMediaService {
  constructor(
    @InjectRepository(CampaignMedia)
    private readonly campaignMediaRepository: Repository<CampaignMedia>,
  ) {}

  async addMediaToCampaign(
    campaignId: string,
    mediaData: {
      mediaUrl: string;
      mediaType?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      isPrimary?: boolean;
    },
  ): Promise<CampaignMedia> {
    // If this is marked as primary, unset other primary media for this campaign
    if (mediaData.isPrimary) {
      await this.campaignMediaRepository.update(
        { campaignId },
        { isPrimary: false },
      );
    }

    // Get the next display order
    const result = await this.campaignMediaRepository
      .createQueryBuilder('media')
      .select('MAX(media.displayOrder)', 'maxOrder')
      .where('media.campaignId = :campaignId', { campaignId })
      .getRawOne<{ maxOrder: number | null }>();

    const maxOrder = result?.maxOrder ?? 0;

    const newMedia = this.campaignMediaRepository.create({
      campaignId,
      ...mediaData,
      displayOrder: maxOrder + 1,
    });

    return this.campaignMediaRepository.save(newMedia);
  }

  async getCampaignMedia(campaignId: string): Promise<CampaignMedia[]> {
    return this.campaignMediaRepository.find({
      where: { campaignId },
      order: { displayOrder: 'ASC' },
    });
  }

  async getPrimaryMedia(campaignId: string): Promise<CampaignMedia | null> {
    return this.campaignMediaRepository.findOne({
      where: { campaignId, isPrimary: true },
    });
  }

  async updateMediaOrder(
    mediaId: string,
    newOrder: number,
  ): Promise<CampaignMedia | null> {
    await this.campaignMediaRepository.update(mediaId, {
      displayOrder: newOrder,
    });
    return this.campaignMediaRepository.findOne({ where: { id: mediaId } });
  }

  async deleteMedia(mediaId: string): Promise<void> {
    await this.campaignMediaRepository.delete(mediaId);
  }

  async deleteMediaByUrl(
    campaignId: string,
    mediaUrl: string,
  ): Promise<CampaignMedia | null> {
    const media = await this.campaignMediaRepository.findOne({
      where: { campaignId, mediaUrl },
    });

    if (media) {
      await this.campaignMediaRepository.delete(media.id);
      return media;
    }

    return null;
  }

  async setCampaignThumbnail(
    campaignId: string,
    mediaId: string,
  ): Promise<void> {
    // Unset all primary flags for this campaign
    await this.campaignMediaRepository.update(
      { campaignId },
      { isPrimary: false },
    );

    // Set the specified media as primary
    await this.campaignMediaRepository.update(
      { id: mediaId, campaignId },
      { isPrimary: true },
    );
  }
}
