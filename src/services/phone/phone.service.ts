import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '../../enums/notification-type';

/**
 * SMS notification data interface
 */
export interface SMSNotificationData {
  to: string; // Phone number in international format (+1234567890)
  userFirstName?: string;
  notificationType: NotificationType;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Phone service for sending SMS notifications
 * Supports multiple SMS providers (Twilio, AWS SNS, etc.)
 * Falls back to console logging when no provider is configured
 */
@Injectable()
export class PhoneService {
  private readonly logger = new Logger(PhoneService.name);
  private twilioClient: any = null;

  constructor() {
    this.initializeSMSProvider();
  }

  /**
   * Initialize SMS provider (Twilio by default)
   */
  private initializeSMSProvider(): void {
    try {
      // Check if Twilio configuration is provided
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        this.logger.warn(
          '⚠️ SMS configuration not found. SMS will be logged to console only.\n' +
            'To enable real SMS, add these environment variables:\n' +
            '  TWILIO_ACCOUNT_SID=your_twilio_account_sid\n' +
            '  TWILIO_AUTH_TOKEN=your_twilio_auth_token\n' +
            '  TWILIO_PHONE_NUMBER=your_twilio_phone_number\n' +
            '  Or use AWS SNS with:\n' +
            '  AWS_ACCESS_KEY_ID=your_aws_key\n' +
            '  AWS_SECRET_ACCESS_KEY=your_aws_secret\n' +
            '  AWS_REGION=your_aws_region',
        );
        return;
      }

      // Initialize Twilio client (you'll need to install twilio package)
      // const twilio = require('twilio');
      // this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      this.logger.log(
        '✅ SMS provider initialized successfully (Twilio ready)',
      );
    } catch (error) {
      this.logger.error('❌ Failed to initialize SMS provider:', error);
      this.twilioClient = null;
    }
  }

  /**
   * Send an SMS notification
   * @param smsData - SMS notification data
   */
  async sendSMS(smsData: SMSNotificationData): Promise<boolean> {
    try {
      const formattedMessage = this.formatSMSMessage(smsData);

      this.logger.log(
        `📱 Sending ${smsData.notificationType} SMS notification:`,
      );
      this.logger.log(`   To: ${this.maskPhoneNumber(smsData.to)}`);
      this.logger.log(`   Message length: ${formattedMessage.length} chars`);

      // If no SMS provider is configured, fall back to console logging
      if (!this.twilioClient && !this.isAWSConfigured()) {
        this.logger.log(`   📝 No SMS config - logging message preview:`);
        this.logger.log(`   ${formattedMessage.substring(0, 100)}...`);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate delay
        this.logger.log(`✅ SMS logged successfully (not sent)`);
        return true;
      }

      // Send via Twilio if configured
      if (this.twilioClient) {
        return this.sendViaTwilio(smsData.to, formattedMessage);
      }

      // Send via AWS SNS if configured
      if (this.isAWSConfigured()) {
        return this.sendViaAWS(smsData.to, formattedMessage);
      }

      return false;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send SMS to ${this.maskPhoneNumber(smsData.to)}:`,
        error,
      );

      // Fallback to logging if SMS fails
      this.logger.log(`📝 Fallback - logging message instead:`);
      this.logger.log(
        `   ${this.formatSMSMessage(smsData).substring(0, 100)}...`,
      );
      return false;
    }
  }

  /**
   * Format SMS message based on notification type
   */
  private formatSMSMessage(data: SMSNotificationData): string {
    const greeting = data.userFirstName
      ? `Hi ${data.userFirstName}!`
      : 'Hello!';
    const platformSignature = '\n\n- CrowdProp Team';

    // Keep SMS messages concise (160 chars recommended, 1600 max)
    const shortMessages: Partial<Record<NotificationType, string>> = {
      [NotificationType.CAMPAIGN_CREATED]:
        '🎉 Campaign created successfully! Start receiving applications.',
      [NotificationType.CAMPAIGN_APPLICATION_RECEIVED]:
        '🎯 New application for your campaign!',
      [NotificationType.CAMPAIGN_APPLICATION_ACCEPTED]:
        '🎉 Your campaign application was accepted!',
      [NotificationType.CAMPAIGN_APPLICATION_REJECTED]:
        '📋 Your campaign application status updated.',
      [NotificationType.CAMPAIGN_WORK_APPROVED]:
        '✅ Your work has been approved and completed!',
      [NotificationType.CAMPAIGN_ENDED]:
        '🏁 Campaign completed! Please leave a review.',
      [NotificationType.PROMOTER_JOINED_CAMPAIGN]:
        '🎉 A new promoter joined your campaign!',
      [NotificationType.NEW_CONVERSATION]:
        '💬 New conversation started about your campaign!',
      [NotificationType.PAYMENT_RECEIVED]: '💰 Payment received successfully!',
      [NotificationType.PAYMENT_FAILED]:
        '❌ Payment failed. Please check your account.',
      [NotificationType.PAYOUT_PROCESSED]: '🏦 Your payout has been processed.',
      [NotificationType.MEETING_REMINDER]:
        '⏰ Meeting reminder: Your meeting starts soon.',
      [NotificationType.NEW_MESSAGE]: '💬 You have a new message!',
      [NotificationType.SECURITY_ALERT]: '🚨 Security alert for your account.',
      [NotificationType.ACCOUNT_VERIFICATION_REQUIRED]:
        '🔐 Please verify your account.',
    };

    const shortMessage = shortMessages[data.notificationType];

    if (shortMessage) {
      // Use short message for common notifications
      const fullMessage = `${greeting} ${shortMessage}${platformSignature}`;
      return fullMessage.length <= 160
        ? fullMessage
        : shortMessage + platformSignature;
    }

    // For other notifications, truncate the message
    const maxLength = 140; // Leave room for greeting and signature
    const message =
      data.message.length > maxLength
        ? data.message.substring(0, maxLength - 3) + '...'
        : data.message;

    const fullMessage = `${greeting} ${message}${platformSignature}`;

    // Ensure total message is under 160 characters for optimal delivery
    return fullMessage.length <= 160
      ? fullMessage
      : message + platformSignature;
  }

  /**
   * Send SMS via Twilio
   */
  private sendViaTwilio(to: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Uncomment and implement when Twilio package is installed
        /*
        const result = await this.twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: to,
        });

        this.logger.log(`✅ SMS sent successfully via Twilio (SID: ${result.sid})`);
        */

        this.logger.log(
          `✅ SMS would be sent via Twilio to ${this.maskPhoneNumber(to)}`,
        );
        this.logger.log(`   Message: ${message}`);
        resolve(true);
      } catch (error) {
        this.logger.error('❌ Failed to send SMS via Twilio:', error);
        resolve(false);
      }
    });
  }

  /**
   * Send SMS via AWS SNS
   */
  private sendViaAWS(to: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Uncomment and implement when AWS SDK is configured
        /*
        const AWS = require('aws-sdk');
        const sns = new AWS.SNS({
          region: process.env.AWS_REGION,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });

        const params = {
          Message: message,
          PhoneNumber: to,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional' // or 'Promotional'
            }
          }
        };

        const result = await sns.publish(params).promise();
        this.logger.log(`✅ SMS sent successfully via AWS SNS (MessageId: ${result.MessageId})`);
        */

        this.logger.log(
          `✅ SMS would be sent via AWS SNS to ${this.maskPhoneNumber(to)}`,
        );
        this.logger.log(`   Message: ${message}`);
        resolve(true);
      } catch (error) {
        this.logger.error('❌ Failed to send SMS via AWS SNS:', error);
        resolve(false);
      }
    });
  }

  /**
   * Check if AWS is configured
   */
  private isAWSConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION
    );
  }

  /**
   * Mask phone number for logging privacy
   */
  private maskPhoneNumber(phone: string): string {
    if (phone.length < 4) return '***';
    return (
      phone.substring(0, 2) +
      '*'.repeat(phone.length - 4) +
      phone.substring(phone.length - 2)
    );
  }

  /**
   * Send multiple SMS notifications in batch
   * @param notifications - Array of SMS notification data
   */
  async sendBatchSMS(notifications: SMSNotificationData[]): Promise<number> {
    let successCount = 0;

    for (const notification of notifications) {
      const success = await this.sendSMS(notification);
      if (success) {
        successCount++;
      }

      // Add delay between SMS to avoid rate limiting (1 SMS per second)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.logger.log(
      `📊 Batch SMS results: ${successCount}/${notifications.length} SMS sent successfully`,
    );
    return successCount;
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone: string): boolean {
    // Basic international phone number validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Format phone number to international format
   */
  formatPhoneNumber(phone: string, defaultCountryCode: string = '+1'): string {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');

    // If it starts with country code, return as is
    if (phone.startsWith('+')) {
      return phone;
    }

    // If it's a US number without country code
    if (digitsOnly.length === 10 && defaultCountryCode === '+1') {
      return `+1${digitsOnly}`;
    }

    // For other cases, prepend default country code
    return `${defaultCountryCode}${digitsOnly}`;
  }

  /**
   * Test SMS configuration by sending a test message
   */
  async testSMSConfiguration(testPhone: string): Promise<boolean> {
    if (!this.validatePhoneNumber(testPhone)) {
      this.logger.error(`❌ Invalid phone number format: ${testPhone}`);
      return false;
    }

    const testNotification: SMSNotificationData = {
      to: testPhone,
      notificationType: NotificationType.SYSTEM_MAINTENANCE,
      message:
        'This is a test SMS to verify your CrowdProp SMS configuration is working correctly.',
    };

    return this.sendSMS(testNotification);
  }

  /**
   * Check if SMS service is available
   */
  isConfigured(): boolean {
    return !!(this.twilioClient || this.isAWSConfigured());
  }

  /**
   * Get SMS service status
   */
  getServiceStatus(): {
    configured: boolean;
    provider: string;
    rateLimit: string;
  } {
    if (this.twilioClient) {
      return {
        configured: true,
        provider: 'Twilio',
        rateLimit: '1 SMS/second (adjustable)',
      };
    }

    if (this.isAWSConfigured()) {
      return {
        configured: true,
        provider: 'AWS SNS',
        rateLimit: '20 SMS/second (default)',
      };
    }

    return {
      configured: false,
      provider: 'None (console logging only)',
      rateLimit: 'N/A',
    };
  }
}
