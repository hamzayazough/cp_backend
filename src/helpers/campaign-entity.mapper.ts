import { BadRequestException } from '@nestjs/common';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { Campaign } from '../interfaces/campaign';
import { CampaignType } from '../enums/campaign-type';
import { CAMPAIGN_ERROR_MESSAGES } from '../constants/campaign-validation.constants';

export class CampaignEntityMapper {
  /**
   * Converts a CampaignEntity to Campaign interface
   */
  static entityToInterface(entity: CampaignEntity): Campaign {
    const base = {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      advertiserTypes: entity.advertiserTypes,
      isPublic: entity.isPublic,
      mediaUrl: entity.mediaUrl,
      requirements: entity.requirements,
      targetAudience: entity.targetAudience,
      preferredPlatforms: entity.preferredPlatforms,
      deadline: entity.deadline,
      startDate: entity.startDate,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      advertiserId: entity.advertiserId,
      discordInviteLink: entity.discordInviteLink,
    };

    switch (entity.type) {
      case CampaignType.VISIBILITY:
        return {
          ...base,
          type: entity.type,
          cpv: entity.cpv,
          maxViews: entity.maxViews,
          trackingLink: entity.trackingLink,
          minFollowers: entity.minFollowers,
          currentViews: entity.currentViews,
        } as Campaign;

      case CampaignType.CONSULTANT:
        return {
          ...base,
          type: entity.type,
          meetingPlan: entity.meetingPlan,
          expertiseRequired: entity.expertiseRequired,
          expectedDeliverables: entity.expectedDeliverables,
          meetingCount: entity.meetingCount,
          maxBudget: entity.maxBudget,
          minBudget: entity.minBudget,
        } as Campaign;

      case CampaignType.SELLER:
        return {
          ...base,
          type: entity.type,
          sellerRequirements: entity.sellerRequirements,
          deliverables: entity.deliverables,
          maxBudget: entity.maxBudget,
          minBudget: entity.minBudget,
          minFollowers: entity.minFollowers,
          needMeeting: false, // Default value since it's not in entity
          meetingPlan: entity.meetingPlan,
          meetingCount: entity.meetingCount || 0,
        } as Campaign;

      case CampaignType.SALESMAN:
        return {
          ...base,
          type: entity.type,
          commissionPerSale: entity.commissionPerSale,
          trackSalesVia: entity.trackSalesVia,
          codePrefix: entity.codePrefix,
          minFollowers: entity.minFollowers,
        } as Campaign;

      default:
        throw new BadRequestException(
          CAMPAIGN_ERROR_MESSAGES.INVALID_CAMPAIGN_TYPE_ENTITY,
        );
    }
  }
}
