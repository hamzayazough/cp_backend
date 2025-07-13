import { BadRequestException } from '@nestjs/common';
import {
  Campaign,
  VisibilityCampaign,
  ConsultantCampaign,
  SellerCampaign,
  SalesmanCampaign,
} from '../interfaces/campaign';
import { CampaignType } from '../enums/campaign-type';
import { CAMPAIGN_VALIDATION_MESSAGES } from '../constants/campaign-validation.constants';

export class CampaignValidationHelper {
  /**
   * Validates common campaign fields that are required for all campaign types
   */
  static validateCommonFields(campaignData: Campaign): void {
    if (!campaignData.title || campaignData.title.trim().length === 0) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.TITLE_REQUIRED,
      );
    }

    if (
      !campaignData.description ||
      campaignData.description.trim().length === 0
    ) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.DESCRIPTION_REQUIRED,
      );
    }

    if (!campaignData.startDate) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.START_DATE_REQUIRED,
      );
    }

    if (!campaignData.deadline) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.DEADLINE_REQUIRED,
      );
    }
  }

  /**
   * Validates date constraints (start date and deadline)
   */
  static validateDates(campaignData: Campaign): void {
    const startDate = new Date(campaignData.startDate);
    const deadline = new Date(campaignData.deadline);
    const now = new Date();

    // Set all times to start of day for comparison (ignore time component)
    const startDateOnly = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    const deadlineOnly = new Date(
      deadline.getFullYear(),
      deadline.getMonth(),
      deadline.getDate(),
    );
    const todayOnly = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    if (startDateOnly < todayOnly) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.START_DATE_PAST,
      );
    }

    if (deadlineOnly <= startDateOnly) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.DEADLINE_BEFORE_START,
      );
    }
  }

  /**
   * Validates visibility campaign specific fields
   */
  static validateVisibilityCampaign(campaignData: VisibilityCampaign): void {
    if (!campaignData.cpv || campaignData.cpv <= 0) {
      throw new BadRequestException(CAMPAIGN_VALIDATION_MESSAGES.CPV_REQUIRED);
    }
    if (!campaignData.trackingLink) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.TRACKING_LINK_REQUIRED,
      );
    }
  }

  /**
   * Validates consultant campaign specific fields
   */
  static validateConsultantCampaign(campaignData: ConsultantCampaign): void {
    if (
      !campaignData.expectedDeliverables ||
      campaignData.expectedDeliverables.length === 0
    ) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.EXPECTED_DELIVERABLES_REQUIRED,
      );
    }
    this.validateBudgetFields(campaignData.maxBudget, campaignData.minBudget);
  }

  /**
   * Validates seller campaign specific fields
   */
  static validateSellerCampaign(campaignData: SellerCampaign): void {
    this.validateBudgetFields(campaignData.maxBudget, campaignData.minBudget);
  }

  /**
   * Validates salesman campaign specific fields
   */
  static validateSalesmanCampaign(campaignData: SalesmanCampaign): void {
    if (
      !campaignData.commissionPerSale ||
      campaignData.commissionPerSale <= 0
    ) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.COMMISSION_REQUIRED,
      );
    }
    if (!campaignData.trackSalesVia) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.SALES_TRACKING_REQUIRED,
      );
    }
  }

  /**
   * Validates budget fields (min and max budget)
   */
  private static validateBudgetFields(
    maxBudget: number,
    minBudget: number,
  ): void {
    if (!maxBudget || maxBudget <= 0) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.MAX_BUDGET_REQUIRED,
      );
    }
    if (!minBudget || minBudget <= 0) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.MIN_BUDGET_REQUIRED,
      );
    }
    if (minBudget >= maxBudget) {
      throw new BadRequestException(
        CAMPAIGN_VALIDATION_MESSAGES.MIN_BUDGET_LESS_THAN_MAX,
      );
    }
  }

  /**
   * Validates campaign data based on its type
   */
  static validateCampaignByType(campaignData: Campaign): void {
    // Validate common fields first
    this.validateCommonFields(campaignData);
    this.validateDates(campaignData);

    // Validate type-specific fields
    switch (campaignData.type) {
      case CampaignType.VISIBILITY:
        this.validateVisibilityCampaign(campaignData);
        break;

      case CampaignType.CONSULTANT:
        this.validateConsultantCampaign(campaignData);
        break;

      case CampaignType.SELLER:
        this.validateSellerCampaign(campaignData);
        break;

      case CampaignType.SALESMAN:
        this.validateSalesmanCampaign(campaignData);
        break;

      default:
        throw new BadRequestException(
          CAMPAIGN_VALIDATION_MESSAGES.INVALID_CAMPAIGN_TYPE,
        );
    }
  }
}
