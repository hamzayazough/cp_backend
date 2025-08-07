import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';

@Injectable()
export class DiscordService implements OnModuleInit {
  private readonly logger = new Logger(DiscordService.name);
  private readonly guildId: string;
  private readonly botToken: string;
  private client: Client;
  private isReady = false;

  constructor(private configService: ConfigService) {
    this.guildId = this.configService.get<string>('DISCORD_GUILD_ID') || '';
    this.botToken = this.configService.get<string>('DISCORD_BOT_TOKEN') || '';

    if (!this.guildId || !this.botToken) {
      this.logger.warn('Discord configuration missing. Discord features will be disabled.');
      return;
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.setupEventHandlers();
  }

  async onModuleInit() {
    if (!this.botToken) {
      return;
    }

    try {
      await this.client.login(this.botToken);
    } catch (error) {
      this.logger.error('Failed to login to Discord', error);
    }
  }

  private setupEventHandlers() {
    this.client.once('ready', () => {
      this.isReady = true;
      this.logger.log(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('error', (error) => {
      this.logger.error('Discord client error:', error);
    });
  }

  /**
   * Creates a private Discord channel for an advertiser
   * @param advertiserName - Name of the advertiser (will be sanitized for channel name)
   * @param firebaseUid - Firebase UID to use as fallback identifier
   * @returns Promise<string> - Discord channel ID
   */
  async createAdvertiserChannel(advertiserName: string, firebaseUid: string): Promise<string | null> {
    if (!this.isReady || !this.guildId) {
      this.logger.warn('Discord not ready or not configured, skipping channel creation');
      return null;
    }

    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      if (!guild) {
        this.logger.error('Guild not found');
        return null;
      }

      // Sanitize advertiser name for Discord channel naming
      const channelName = this.sanitizeChannelName(`advertiser-${advertiserName}`);

      // Check if channel already exists
      const existingChannel = guild.channels.cache.find(
        channel => channel.name === channelName && channel.type === ChannelType.GuildText
      );

      if (existingChannel) {
        this.logger.log(`Channel already exists for advertiser: ${advertiserName}`);
        return existingChannel.id;
      }

      // Create the channel with restricted permissions
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        topic: `Private channel for advertiser: ${advertiserName} (Firebase UID: ${firebaseUid})`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id, // @everyone role
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: this.client.user!.id, // Bot permissions
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageThreads,
            ],
          },
        ],
      });

      this.logger.log(`Created Discord channel for advertiser: ${advertiserName} (ID: ${channel.id})`);
      return channel.id;
    } catch (error) {
      this.logger.error(`Failed to create Discord channel for advertiser: ${advertiserName}`, error);
      return null;
    }
  }

  /**
   * Creates a private thread for a campaign under the advertiser's channel
   * @param campaignName - Name of the campaign
   * @param channelId - Parent channel ID
   * @returns Promise<{threadId: string, inviteUrl: string} | null>
   */
  async createCampaignThread(
    campaignName: string,
    channelId: string,
  ): Promise<{ threadId: string; inviteUrl: string } | null> {
    if (!this.isReady || !this.guildId) {
      this.logger.warn('Discord not ready or not configured, skipping thread creation');
      return null;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.error('Channel not found or not text-based');
        return null;
      }

      // Check if the channel supports threads
      if (!('threads' in channel)) {
        this.logger.error('Channel does not support threads');
        return null;
      }

      // Sanitize campaign name for thread naming
      const threadName = this.sanitizeThreadName(`campaign-${campaignName}`);

      // Create the thread
      const thread = await channel.threads.create({
        name: threadName,
        autoArchiveDuration: 1440, // 24 hours
        reason: `Campaign thread for: ${campaignName}`,
      });

      // Generate invite link from the parent channel (threads use parent channel invites)
      const invite = await channel.createInvite({
        maxAge: 0, // Never expires
        maxUses: 0, // Unlimited uses
        unique: true,
        reason: `Invite for campaign: ${campaignName}`,
      });

      this.logger.log(`Created Discord thread for campaign: ${campaignName} (Thread ID: ${thread.id})`);
      return {
        threadId: thread.id,
        inviteUrl: invite.url,
      };
    } catch (error) {
      this.logger.error(`Failed to create Discord thread for campaign: ${campaignName}`, error);
      return null;
    }
  }

  /**
   * Adds a user to a Discord channel by their Firebase UID (placeholder - would need Discord OAuth integration)
   * For now, this is a placeholder that logs the action
   */
  addUserToChannel(channelId: string, firebaseUid: string): boolean {
    this.logger.log(`Would add user with Firebase UID ${firebaseUid} to channel ${channelId}`);
    // TODO: Implement Discord OAuth integration to map Firebase UIDs to Discord user IDs
    return true;
  }

  /**
   * Sanitizes a string to be used as a Discord channel name
   */
  private sanitizeChannelName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100); // Discord channel name limit
  }

  /**
   * Sanitizes a string to be used as a Discord thread name
   */
  private sanitizeThreadName(name: string): string {
    return name
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100); // Discord thread name limit
  }

  /**
   * Deletes a Discord thread (for cleanup when campaign ends)
   */
  async deleteCampaignThread(threadId: string): Promise<boolean> {
    if (!this.isReady) {
      return false;
    }

    try {
      const thread = await this.client.channels.fetch(threadId);
      if (thread && thread.isThread()) {
        await thread.delete('Campaign ended');
        this.logger.log(`Deleted Discord thread: ${threadId}`);
        return true;
      }
    } catch (error) {
      this.logger.error(`Failed to delete Discord thread: ${threadId}`, error);
    }
    return false;
  }

  /**
   * Generate a Discord channel URL from channel ID
   */
  generateChannelUrl(channelId: string): string {
    return `https://discord.com/channels/${this.guildId}/${channelId}`;
  }

  /**
   * Generate a Discord thread URL from channel ID and thread ID
   */
  generateThreadUrl(channelId: string, threadId: string): string {
    return `https://discord.com/channels/${this.guildId}/${channelId}/${threadId}`;
  }
}
