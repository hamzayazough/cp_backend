import { Injectable, Logger } from '@nestjs/common';
import { EmailNotificationData } from '../../interfaces/campaign-management';
import { NotificationType } from '../../enums/notification-type';
import * as nodemailer from 'nodemailer';

/**
 * Enhanced notification data interface for all notification types
 */
export interface NotificationEmailData {
  to: string;
  userFirstName?: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  templateVariables?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Email service using Gmail/Nodemailer for sending notifications
 * Uses Gmail's free SMTP service (500 emails/day limit)
 * Supports all notification types with dynamic templates
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize Gmail SMTP transporter
   */
  private initializeTransporter(): void {
    try {
      // Check if email configuration is provided
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        this.logger.warn(
          '⚠️ Email configuration not found. Emails will be logged to console only.\n' +
            'To enable real emails, add these environment variables:\n' +
            '  SMTP_USER=your_gmail@gmail.com\n' +
            '  SMTP_PASS=your_gmail_app_password\n' +
            '  FROM_EMAIL=your_gmail@gmail.com (optional)',
        );
        return;
      }

      this.transporter = nodemailer.createTransport({
        service: 'gmail', // Uses Gmail's SMTP settings automatically
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS, // Use App Password, not regular password
        },
      });

      this.logger.log('✅ Gmail SMTP transporter initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize email transporter:', error);
      this.transporter = null;
    }
  }

  /**
   * Send an email notification (legacy method for backward compatibility)
   * @param emailData - Email notification data
   */
  async sendEmail(emailData: EmailNotificationData): Promise<boolean> {
    const notificationData: NotificationEmailData = {
      to: emailData.to,
      notificationType: NotificationType.SYSTEM_MAINTENANCE, // Default fallback
      title: emailData.subject,
      message: emailData.message,
      templateVariables: emailData.templateVariables,
    };

    return this.sendNotificationEmail(notificationData);
  }

  /**
   * Send a notification email with dynamic templates based on notification type
   * @param notificationData - Notification email data
   */
  async sendNotificationEmail(
    notificationData: NotificationEmailData,
  ): Promise<boolean> {
    try {
      const subject = this.generateEmailSubject(notificationData);
      const htmlContent = this.generateEmailContent(notificationData);

      this.logger.log(
        `📧 Sending ${notificationData.notificationType} email notification:`,
      );
      this.logger.log(`   To: ${notificationData.to}`);
      this.logger.log(`   Subject: ${subject}`);

      // If no transporter is configured, fall back to console logging
      if (!this.transporter) {
        this.logger.log(`   📝 No email config - logging message preview:`);
        this.logger.log(`   ${notificationData.message.substring(0, 200)}...`);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate delay
        this.logger.log(`✅ Email logged successfully (not sent)`);
        return true;
      }

      // Send real email using Gmail SMTP
      const mailOptions = {
        from: `"CrowdProp Platform" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: notificationData.to,
        subject,
        text: notificationData.message,
        html: htmlContent,
      };

      await this.transporter.sendMail(mailOptions);

      this.logger.log(
        `✅ Email sent successfully via Gmail to ${notificationData.to}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send email to ${notificationData.to}:`,
        error,
      );

      // Fallback to logging if email fails
      this.logger.log(`📝 Fallback - logging message instead:`);
      this.logger.log(`   ${notificationData.message.substring(0, 200)}...`);
      return false;
    }
  }

  /**
   * Generate email subject based on notification type
   */
  private generateEmailSubject(data: NotificationEmailData): string {
    const subjectTemplates: Record<NotificationType, string> = {
      // Campaign notifications
      [NotificationType.CAMPAIGN_CREATED]: '🎉 Campaign Created Successfully!',
      [NotificationType.CAMPAIGN_APPLICATION_RECEIVED]:
        '🎯 New Application for Your Campaign',
      [NotificationType.CAMPAIGN_APPLICATION_ACCEPTED]:
        '🎉 Your Campaign Application Was Accepted!',
      [NotificationType.CAMPAIGN_APPLICATION_REJECTED]:
        '📋 Campaign Application Update',
      [NotificationType.CAMPAIGN_WORK_SUBMITTED]:
        '📤 Work Submitted for Review',
      [NotificationType.CAMPAIGN_WORK_APPROVED]:
        '✅ Your Work Has Been Approved!',
      [NotificationType.CAMPAIGN_WORK_REJECTED]: '🔄 Work Revision Required',
      [NotificationType.CAMPAIGN_DETAILS_CHANGED]:
        '📝 Campaign Details Updated',
      [NotificationType.CAMPAIGN_ENDING_SOON]: '⏰ Campaign Ending Soon',
      [NotificationType.CAMPAIGN_ENDED]: '🏁 Campaign Completed',
      [NotificationType.CAMPAIGN_BUDGET_INCREASED]:
        '💰 Campaign Budget Increased',
      [NotificationType.CAMPAIGN_DEADLINE_EXTENDED]:
        '📅 Campaign Deadline Extended',

      // Payment notifications
      [NotificationType.PAYMENT_RECEIVED]: '💰 Payment Received',
      [NotificationType.PAYMENT_SENT]: '💸 Payment Sent',
      [NotificationType.PAYMENT_FAILED]: '❌ Payment Failed',
      [NotificationType.PAYOUT_PROCESSED]: '🏦 Payout Processed',
      [NotificationType.STRIPE_ACCOUNT_VERIFIED]: '✅ Payment Account Verified',
      [NotificationType.STRIPE_ACCOUNT_ISSUE]: '⚠️ Payment Account Issue',
      [NotificationType.WALLET_BALANCE_LOW]: '💳 Low Wallet Balance',

      // Messaging notifications
      [NotificationType.NEW_MESSAGE]: '💬 New Message',
      [NotificationType.NEW_CONVERSATION]: '🗨️ New Conversation Started',

      // Meeting notifications
      [NotificationType.MEETING_SCHEDULED]: '📅 Meeting Scheduled',
      [NotificationType.MEETING_REMINDER]: '⏰ Meeting Reminder',
      [NotificationType.MEETING_CANCELLED]: '❌ Meeting Cancelled',
      [NotificationType.MEETING_RESCHEDULED]: '📅 Meeting Rescheduled',

      // Account notifications
      [NotificationType.ACCOUNT_VERIFICATION_REQUIRED]:
        '🔐 Account Verification Required',
      [NotificationType.ACCOUNT_VERIFIED]: '✅ Account Verified',
      [NotificationType.PROFILE_INCOMPLETE]: '👤 Complete Your Profile',

      // System notifications
      [NotificationType.SYSTEM_MAINTENANCE]: '🔧 System Maintenance',
      [NotificationType.FEATURE_ANNOUNCEMENT]: '🎉 New Feature Announcement',
      [NotificationType.SECURITY_ALERT]: '🚨 Security Alert',
    };

    return subjectTemplates[data.notificationType] || data.title;
  }

  /**
   * Generate HTML email content with professional styling
   */
  private generateEmailContent(data: NotificationEmailData): string {
    const greeting = data.userFirstName
      ? `Hi ${data.userFirstName},`
      : 'Hello,';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CrowdProp Notification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .notification-type { background: #e3f2fd; padding: 8px 12px; border-radius: 4px; font-size: 12px; color: #1976d2; margin-bottom: 15px; }
        .message-content { background: #f8f9fa; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 CrowdProp</h1>
            <p>Influencer Marketing Platform</p>
        </div>
        <div class="content">
            <div class="notification-type">
                ${this.getNotificationTypeLabel(data.notificationType)}
            </div>
            <p>${greeting}</p>
            <div class="message-content">
                ${this.convertToHtml(data.message)}
            </div>
            ${this.generateActionButton(data)}
            ${this.generateMetadataSection(data.metadata)}
        </div>
        <div class="footer">
            <p>This is an automated notification from CrowdProp Platform</p>
            <p>Visit your <a href="${process.env.FRONTEND_URL || 'https://crowdprop.com'}/dashboard">dashboard</a> to manage your notification preferences</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Get user-friendly label for notification type
   */
  private getNotificationTypeLabel(type: NotificationType): string {
    const labels: Record<NotificationType, string> = {
      [NotificationType.CAMPAIGN_CREATED]: 'Campaign Created',
      [NotificationType.CAMPAIGN_APPLICATION_RECEIVED]: 'Campaign Application',
      [NotificationType.CAMPAIGN_APPLICATION_ACCEPTED]: 'Application Accepted',
      [NotificationType.CAMPAIGN_APPLICATION_REJECTED]: 'Application Update',
      [NotificationType.CAMPAIGN_WORK_SUBMITTED]: 'Work Submission',
      [NotificationType.CAMPAIGN_WORK_APPROVED]: 'Work Approved',
      [NotificationType.CAMPAIGN_WORK_REJECTED]: 'Work Revision',
      [NotificationType.CAMPAIGN_DETAILS_CHANGED]: 'Campaign Update',
      [NotificationType.CAMPAIGN_ENDING_SOON]: 'Campaign Reminder',
      [NotificationType.CAMPAIGN_ENDED]: 'Campaign Completed',
      [NotificationType.CAMPAIGN_BUDGET_INCREASED]: 'Budget Update',
      [NotificationType.CAMPAIGN_DEADLINE_EXTENDED]: 'Deadline Extended',
      [NotificationType.PAYMENT_RECEIVED]: 'Payment Notification',
      [NotificationType.PAYMENT_SENT]: 'Payment Confirmation',
      [NotificationType.PAYMENT_FAILED]: 'Payment Alert',
      [NotificationType.PAYOUT_PROCESSED]: 'Payout Notification',
      [NotificationType.STRIPE_ACCOUNT_VERIFIED]: 'Account Verified',
      [NotificationType.STRIPE_ACCOUNT_ISSUE]: 'Account Alert',
      [NotificationType.WALLET_BALANCE_LOW]: 'Balance Alert',
      [NotificationType.NEW_MESSAGE]: 'New Message',
      [NotificationType.NEW_CONVERSATION]: 'New Conversation',
      [NotificationType.MEETING_SCHEDULED]: 'Meeting Scheduled',
      [NotificationType.MEETING_REMINDER]: 'Meeting Reminder',
      [NotificationType.MEETING_CANCELLED]: 'Meeting Update',
      [NotificationType.MEETING_RESCHEDULED]: 'Meeting Rescheduled',
      [NotificationType.ACCOUNT_VERIFICATION_REQUIRED]: 'Verification Required',
      [NotificationType.ACCOUNT_VERIFIED]: 'Account Verified',
      [NotificationType.PROFILE_INCOMPLETE]: 'Profile Update',
      [NotificationType.SYSTEM_MAINTENANCE]: 'System Notice',
      [NotificationType.FEATURE_ANNOUNCEMENT]: 'Platform Update',
      [NotificationType.SECURITY_ALERT]: 'Security Alert',
    };

    return labels[type] || 'Notification';
  }

  /**
   * Generate action button based on notification type
   */
  private generateActionButton(data: NotificationEmailData): string {
    const baseUrl = process.env.FRONTEND_URL || 'https://crowdprop.com';

    const actionUrls: Partial<Record<NotificationType, string>> = {
      [NotificationType.CAMPAIGN_APPLICATION_RECEIVED]: `${baseUrl}/campaigns/manage`,
      [NotificationType.CAMPAIGN_APPLICATION_ACCEPTED]: `${baseUrl}/campaigns/my-campaigns`,
      [NotificationType.CAMPAIGN_WORK_SUBMITTED]: `${baseUrl}/campaigns/manage`,
      [NotificationType.PAYMENT_RECEIVED]: `${baseUrl}/wallet`,
      [NotificationType.PAYMENT_SENT]: `${baseUrl}/wallet`,
      [NotificationType.NEW_MESSAGE]: `${baseUrl}/messages`,
      [NotificationType.MEETING_SCHEDULED]: `${baseUrl}/meetings`,
      [NotificationType.ACCOUNT_VERIFICATION_REQUIRED]: `${baseUrl}/profile/verification`,
    };

    const actionUrl = actionUrls[data.notificationType];

    if (actionUrl) {
      return `<p style="text-align: center;"><a href="${actionUrl}" class="button">View Details</a></p>`;
    }

    return '';
  }

  /**
   * Generate metadata section if metadata exists
   */
  private generateMetadataSection(metadata?: Record<string, any>): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return '';
    }

    const metadataItems = Object.entries(metadata)
      .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
      .join('');

    return `
      <div style="margin-top: 20px; font-size: 14px;">
        <h4>Additional Details:</h4>
        <ul>${metadataItems}</ul>
      </div>
    `;
  }

  /**
   * Convert plain text message to basic HTML with better formatting
   */
  private convertToHtml(message: string): string {
    return message
      .split('\n\n')
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  /**
   * Send multiple emails in batch (legacy method)
   * @param emails - Array of email notification data
   */
  async sendBatchEmails(emails: EmailNotificationData[]): Promise<number> {
    let successCount = 0;

    for (const email of emails) {
      const success = await this.sendEmail(email);
      if (success) {
        successCount++;
      }
    }

    this.logger.log(
      `📊 Batch email results: ${successCount}/${emails.length} emails sent successfully`,
    );
    return successCount;
  }

  /**
   * Send multiple notification emails in batch
   * @param notifications - Array of notification email data
   */
  async sendBatchNotificationEmails(
    notifications: NotificationEmailData[],
  ): Promise<number> {
    let successCount = 0;

    for (const notification of notifications) {
      const success = await this.sendNotificationEmail(notification);
      if (success) {
        successCount++;
      }

      // Add small delay between emails to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.log(
      `📊 Batch notification email results: ${successCount}/${notifications.length} emails sent successfully`,
    );
    return successCount;
  }

  /**
   * Test email configuration by sending a test email
   */
  async testEmailConfiguration(testEmail: string): Promise<boolean> {
    const testNotification: NotificationEmailData = {
      to: testEmail,
      notificationType: NotificationType.SYSTEM_MAINTENANCE,
      title: 'Email Configuration Test',
      message:
        'This is a test email to verify your CrowdProp email configuration is working correctly.',
      templateVariables: {
        testDate: new Date().toISOString(),
      },
    };

    return this.sendNotificationEmail(testNotification);
  }
}
