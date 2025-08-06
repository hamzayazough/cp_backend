import { Injectable, Logger } from '@nestjs/common';
import { EmailNotificationData } from '../../interfaces/campaign-management';
import * as nodemailer from 'nodemailer';

/**
 * Email service using Gmail/Nodemailer for sending notifications
 * Uses Gmail's free SMTP service (500 emails/day limit)
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
   * Send an email notification
   * @param emailData - Email notification data
   */
  async sendEmail(emailData: EmailNotificationData): Promise<boolean> {
    try {
      this.logger.log(`📧 Sending email notification:`);
      this.logger.log(`   To: ${emailData.to}`);
      this.logger.log(`   Subject: ${emailData.subject}`);
      this.logger.log(`   Template Type: ${emailData.templateType}`);

      // If no transporter is configured, fall back to console logging
      if (!this.transporter) {
        this.logger.log(`   📝 No email config - logging message preview:`);
        this.logger.log(`   ${emailData.message.substring(0, 200)}...`);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate delay
        this.logger.log(`✅ Email logged successfully (not sent)`);
        return true;
      }

      // Send real email using Gmail SMTP
      const mailOptions = {
        from: `"CrowdProp Platform" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.message,
        html: this.convertToHtml(emailData.message),
      };

      await this.transporter.sendMail(mailOptions);

      this.logger.log(
        `✅ Email sent successfully via Gmail to ${emailData.to}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${emailData.to}:`, error);

      // Fallback to logging if email fails
      this.logger.log(`📝 Fallback - logging message instead:`);
      this.logger.log(`   ${emailData.message.substring(0, 200)}...`);
      return false;
    }
  }

  /**
   * Convert plain text message to basic HTML
   */
  private convertToHtml(message: string): string {
    return message
      .split('\n\n')
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  /**
   * Send multiple emails in batch
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
}
