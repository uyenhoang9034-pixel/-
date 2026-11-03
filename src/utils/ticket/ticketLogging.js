// ticketLogging.js

import {
  ChannelType,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  EmbedBuilder,
} from 'discord.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import { logger } from '../logger.js';
import { formatRatingStars } from '../logging/logEmbeds.js';

export async function logTicketEvent({ client, guildId, event }) {
  try {
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      logger.warn(`logTicketEvent invoked without valid guild: ${guildId}`);
      return;
    }

    const config = await getGuildConfig(client, guildId);

    const logChannelId = getLogChannelForEventType(config, event.type);
    if (!logChannelId) {
      return;
    }

    const channel = guild.channels.cache.get(logChannelId) || await guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel) {
      logger.warn(`Ticket log channel not found: ${logChannelId} for event type: ${event.type}`);
      return;
    }

    const permissions = channel.permissionsFor(guild.members.me);
    if (!permissions.has(['SendMessages', 'EmbedLinks'])) {
      logger.warn(`Missing permissions in ticket log channel: ${logChannelId}`);
      return;
    }

    const files = event.attachments && event.attachments.length > 0 ? event.attachments : undefined;

    try {
      const v2Container = buildTicketLogV2Container(guild, event);
      await channel.send({
        components: [v2Container],
        flags: MessageFlags.IsComponentsV2,
        files,
      });
    } catch (v2Err) {
      logger.warn('Failed to send ticket log as Components V2, falling back to embed:', v2Err);
      const fallbackEmbed = buildTicketLogFallbackEmbed(guild, event);
      await channel.send({
        embeds: [fallbackEmbed],
        files,
      });
    }

    logger.info(`Ticket event logged: ${event.type} in guild ${guildId}`);
  } catch (error) {
    logger.error('Error logging ticket event:', error);
  }
}

export async function logTicketFeedback({
  client,
  guildId,
  ticketNumber,
  ticketChannelId,
  userId,
  rating = null,
  comment = null,
}) {
  await logTicketEvent({
    client,
    guildId,
    event: {
      type: 'feedback',
      ticketId: ticketChannelId,
      ticketNumber,
      userId,
      metadata: {
        rating,
        comment,
      },
    },
  });
}

function getLogChannelForEventType(config, eventType) {
  switch (eventType) {
    case 'transcript':
      return config.ticketTranscriptChannelId || null;

    case 'open':
    case 'close':
    case 'delete':
    case 'claim':
    case 'unclaim':
    case 'pin':
    case 'unpin':
    case 'feedback':
      return config.ticketLogsChannelId || null;

    default:
      return null;
  }
}

export function buildTicketLogV2Container(guild, event) {
  const container = new ContainerBuilder();
  let rawNumber = event.ticketNumber;
  if (!rawNumber || /^\d{17,20}$/.test(String(rawNumber))) {
    const cached = guild?.channels?.cache?.get(event.ticketId) || guild?.client?.channels?.cache?.get(event.ticketId);
    if (cached?.name) {
      rawNumber = cached.name;
    }
  }
  const ticketRef = rawNumber
    ? (String(rawNumber).startsWith('#') ? String(rawNumber) : `#${rawNumber}`)
    : (event.ticketId ? `<#${event.ticketId}>` : 'Unknown');

  let title = '';
  let mainLines = [];
  let extraLine = null;

  switch (event.type) {
    case 'feedback': {
      title = '<a:trangtrig2:1546040703375904801> **FEEDBACK RECEIVED** <a:trangtrig3:1546040818261954610>';
      const rating = event.metadata?.rating ?? event.rating;
      const comment = event.metadata?.comment;
      const ratingDisplay = formatRatingStars(rating) || 'Chưa đánh giá';

      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Người đánh giá: <@${event.userId}> | ID: ${event.userId}`,
        `<a:trangtrig15:1546047955696488489> Đánh giá: ${ratingDisplay}`,
      ];

      if (comment && String(comment).trim().length > 0) {
        extraLine = `<a:trangtrig31:1546905996893626440> Nhận xét: "${String(comment).trim()}"`;
      }
      break;
    }

    case 'open': {
      title = '<a:trangtrig2:1546040703375904801> **TICKET CREATED** <a:trangtrig3:1546040818261954610>';
      const channelDisplay = event.ticketId ? `<#${event.ticketId}>` : ticketRef;
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Người tạo: <@${event.userId}> | ID: ${event.userId}`,
        `<a:trangtrig15:1546047955696488489> Kênh: ${channelDisplay}`,
      ];
      extraLine = `<a:trangtrig31:1546905996893626440> Lý do: "${event.reason || 'Không có lý do'}"`;
      break;
    }

    case 'close': {
      title = '<a:trangtrig2:1546040703375904801> **TICKET CLOSED** <a:trangtrig3:1546040818261954610>';
      const channelDisplay = event.ticketId ? `<#${event.ticketId}>` : ticketRef;
      const closerMention = event.executorId ? `<@${event.executorId}>` : 'Unknown';
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Đóng bởi: ${closerMention}`,
        `<a:trangtrig15:1546047955696488489> Kênh: ${channelDisplay}`,
      ];
      extraLine = `<a:trangtrig31:1546905996893626440> Lý do đóng: "${event.reason || 'Không có lý do'}"`;
      break;
    }

    case 'delete': {
      title = '<a:trangtrig2:1546040703375904801> **TICKET DELETED** <a:trangtrig3:1546040818261954610>';
      const deleterMention = event.executorId ? `<@${event.executorId}>` : 'Unknown';
      const creatorDisplay = event.userId ? `<@${event.userId}> | ID: ${event.userId}` : 'Unknown';
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Xóa bởi: ${deleterMention}`,
        `<a:trangtrig15:1546047955696488489> Chủ ticket: ${creatorDisplay}`,
      ];
      break;
    }

    case 'claim': {
      title = '<a:trangtrig2:1546040703375904801> **TICKET CLAIMED** <a:trangtrig3:1546040818261954610>';
      const claimerMention = event.executorId ? `<@${event.executorId}>` : 'Unknown';
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Nhận bởi: ${claimerMention}`,
      ];
      break;
    }

    case 'unclaim': {
      title = '<a:trangtrig2:1546040703375904801> **TICKET UNCLAIMED** <a:trangtrig3:1546040818261954610>';
      const unclaimerMention = event.executorId ? `<@${event.executorId}>` : 'Unknown';
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Bỏ nhận bởi: ${unclaimerMention}`,
      ];
      break;
    }

    default: {
      title = `<a:trangtrig2:1546040703375904801> **TICKET ${String(event.type || 'EVENT').toUpperCase()}** <a:trangtrig3:1546040818261954610>`;
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
      ];
      if (event.reason) {
        extraLine = `<a:trangtrig31:1546905996893626440> Chi tiết: "${event.reason}"`;
      }
      break;
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${title}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(mainLines.join('\n'))
  );

  if (extraLine) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(extraLine)
    );
  }

  return container;
}

export function buildTicketLogFallbackEmbed(guild, event) {
  let rawNumber = event.ticketNumber;
  if (!rawNumber || /^\d{17,20}$/.test(String(rawNumber))) {
    const cached = guild?.channels?.cache?.get(event.ticketId) || guild?.client?.channels?.cache?.get(event.ticketId);
    if (cached?.name) {
      rawNumber = cached.name;
    }
  }
  const ticketRef = rawNumber
    ? (String(rawNumber).startsWith('#') ? String(rawNumber) : `#${rawNumber}`)
    : (event.ticketId ? `<#${event.ticketId}>` : 'Unknown');

  let title = '';
  let mainLines = [];
  let extraLine = null;

  switch (event.type) {
    case 'feedback': {
      title = '<a:trangtrig2:1546040703375904801> **FEEDBACK RECEIVED** <a:trangtrig3:1546040818261954610>';
      const rating = event.metadata?.rating ?? event.rating;
      const comment = event.metadata?.comment;
      const ratingDisplay = formatRatingStars(rating) || 'Chưa đánh giá';

      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Người đánh giá: <@${event.userId}> | ID: ${event.userId}`,
        `<a:trangtrig15:1546047955696488489> Đánh giá: ${ratingDisplay}`,
      ];

      if (comment && String(comment).trim().length > 0) {
        extraLine = `<a:trangtrig31:1546905996893626440> Nhận xét: "${String(comment).trim()}"`;
      }
      break;
    }

    case 'open': {
      title = '<a:trangtrig2:1546040703375904801> **TICKET CREATED** <a:trangtrig3:1546040818261954610>';
      const channelDisplay = event.ticketId ? `<#${event.ticketId}>` : ticketRef;
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Người tạo: <@${event.userId}> | ID: ${event.userId}`,
        `<a:trangtrig15:1546047955696488489> Kênh: ${channelDisplay}`,
      ];
      extraLine = `<a:trangtrig31:1546905996893626440> Lý do: "${event.reason || 'Không có lý do'}"`;
      break;
    }

    case 'close': {
      title = '<a:trangtrig2:1546040703375904801> **TICKET CLOSED** <a:trangtrig3:1546040818261954610>';
      const channelDisplay = event.ticketId ? `<#${event.ticketId}>` : ticketRef;
      const closerMention = event.executorId ? `<@${event.executorId}>` : 'Unknown';
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Đóng bởi: ${closerMention}`,
        `<a:trangtrig15:1546047955696488489> Kênh: ${channelDisplay}`,
      ];
      extraLine = `<a:trangtrig31:1546905996893626440> Lý do đóng: "${event.reason || 'Không có lý do'}"`;
      break;
    }

    case 'delete': {
      title = '<a:trangtrig2:1546040703375904801> **TICKET DELETED** <a:trangtrig3:1546040818261954610>';
      const deleterMention = event.executorId ? `<@${event.executorId}>` : 'Unknown';
      const creatorDisplay = event.userId ? `<@${event.userId}> | ID: ${event.userId}` : 'Unknown';
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Xóa bởi: ${deleterMention}`,
        `<a:trangtrig15:1546047955696488489> Chủ ticket: ${creatorDisplay}`,
      ];
      break;
    }

    case 'claim': {
      title = '<a:trangtrig2:1546040703375904801> **TICKET CLAIMED** <a:trangtrig3:1546040818261954610>';
      const claimerMention = event.executorId ? `<@${event.executorId}>` : 'Unknown';
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Nhận bởi: ${claimerMention}`,
      ];
      break;
    }

    case 'unclaim': {
      title = '<a:trangtrig2:1546040703375904801> **TICKET UNCLAIMED** <a:trangtrig3:1546040818261954610>';
      const unclaimerMention = event.executorId ? `<@${event.executorId}>` : 'Unknown';
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
        `<a:trangtrig15:1546047955696488489> Bỏ nhận bởi: ${unclaimerMention}`,
      ];
      break;
    }

    default: {
      title = `<a:trangtrig2:1546040703375904801> **TICKET ${String(event.type || 'EVENT').toUpperCase()}** <a:trangtrig3:1546040818261954610>`;
      mainLines = [
        `<a:trangtrig15:1546047955696488489> Ticket: ${ticketRef}`,
      ];
      if (event.reason) {
        extraLine = `<a:trangtrig31:1546905996893626440> Chi tiết: "${event.reason}"`;
      }
      break;
    }
  }

  const descParts = [
    `# ${title}`,
    '---',
    mainLines.join('\n'),
  ];
  if (extraLine) {
    descParts.push('---', extraLine);
  }

  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setDescription(descParts.join('\n'));
}

export async function createTicketLogEmbed(guild, event) {
  return buildTicketLogFallbackEmbed(guild, event);
}

export async function getTicketLoggingConfig(client, guildId) {
  const config = await getGuildConfig(client, guildId);
  return {
    enabled: !!(config.ticketLogsChannelId || config.ticketTranscriptChannelId),
    lifecycleChannelId: config.ticketLogsChannelId || null,
    transcriptChannelId: config.ticketTranscriptChannelId || null,
  };
}

export function validateLogChannel(channel, botMember) {
  if (!channel || channel.type !== ChannelType.GuildText) {
    return {
      valid: false,
      error: 'Channel must be a text channel.',
    };
  }

  const permissions = channel.permissionsFor(botMember);
  const requiredPermissions = ['SendMessages', 'EmbedLinks'];

  const missing = requiredPermissions.filter((perm) => !permissions.has(perm));

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing permissions: ${missing.join(', ')}`,
    };
  }

  return { valid: true };
}

