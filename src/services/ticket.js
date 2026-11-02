// ticket.js

import fs from 'fs';
import path from 'path';

import {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} from 'discord.js';

import {
  buildStandardLogEmbed,
  formatLogLine,
} from '../utils/logging/logEmbeds.js';

import {
  getGuildConfig,
} from './config/guildConfig.js';

import {
  getTicketData,
  saveTicketData,
  deleteTicketData,
  getOpenTicketCountForUser,
  getOpenTicketCountForStaff,
  incrementTicketCounter,
} from '../utils/database.js';

import {
  logger,
} from '../utils/logger.js';

import {
  createEmbed,
  errorEmbed,
} from '../utils/embeds.js';

import {
  logTicketEvent,
} from '../utils/ticket/ticketLogging.js';

import { generateTranscriptFiles } from '../utils/ticket/ticketTranscript.js';

import {
  createError,
  ErrorTypes,
} from '../utils/errorHandler.js';

import {
  ensureTypedServiceError,
  wrapServiceBoundary,
} from '../utils/serviceErrorBoundary.js';


const TICKET_DELETE_DELAY_MS =
  5000;

const TICKET_DELETE_DELAY_SECONDS =
  Math.floor(
    TICKET_DELETE_DELAY_MS /
    1000,
  );

const TICKET_SERVICE =
  'ticketService';


/**
 * =========================================================
 * TICKET IMAGE
 * =========================================================
 */

export const TICKET_IMAGE_PATH =
  path.resolve(process.cwd(), 'assets/ticket/ticket.png');

export const TICKET_IMAGE_URL =
  'https://files.catbox.moe/xdd9hc.png';

export function getTicketImageAttachment() {
  try {
    if (fs.existsSync(TICKET_IMAGE_PATH)) {
      return new AttachmentBuilder(TICKET_IMAGE_PATH, { name: 'ticket.png' });
    }
  } catch (err) {
    logger.warn('Failed to read ticket asset from disk:', err);
  }
  return null;
}


/**
 * =========================================================
 * ERRORS
 * =========================================================
 */

function ticketUserError(
  message,
  userMessage,
  type = ErrorTypes.VALIDATION,
  context = {},
) {
  throw createError(
    message,
    type,
    userMessage,
    {
      service:
        TICKET_SERVICE,

      ...context,
    },
  );
}


function requireTicket(
  ticketData,
  channel,
) {
  if (!ticketData) {
    ticketUserError(
      'Not a ticket channel',

      'This is not a ticket channel.',

      ErrorTypes.VALIDATION,

      {
        channelId:
          channel?.id,

        guildId:
          channel?.guild?.id,
      },
    );
  }

  return ticketData;
}


function rethrowTicketError(
  error,
  operation,
  userMessage,
  context = {},
) {
  throw ensureTypedServiceError(
    error,
    {
      service:
        TICKET_SERVICE,

      operation,

      message:
        `Ticket operation failed: ${operation}`,

      userMessage,

      context,
    },
  );
}


/**
 * =========================================================
 * TICKET CONTROL ROW
 * =========================================================
 */

const TICKET_BTN_EMOJI = '<a:trangtrig33:1546908181060526130>';

function buildTicketControlRow(
  {
    claimedBy = null,
  } = {},
) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel(claimedBy ? 'Đã nhận' : 'Nhận ticket')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(TICKET_BTN_EMOJI)
        .setDisabled(!!claimedBy),

      new ButtonBuilder()
        .setCustomId('ticket_pin')
        .setLabel('Ghim')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(TICKET_BTN_EMOJI),

      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Đóng')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(TICKET_BTN_EMOJI),
    );
}

export function buildTicketOpenPayload({
  ticketNumber,
  member,
  reason,
  status = 'Đang mở',
  assignedStaff = null,
  createdTimestamp = null,
  claimedBy = null,
  hasImage = false,
  showButtons = true,
}) {
  const ts = createdTimestamp || Math.floor(Date.now() / 1000);
  const userMention = member?.toString?.() || 'bạn';
  const staffMention = assignedStaff
    ? (typeof assignedStaff === 'string' ? assignedStaff : assignedStaff.toString())
    : 'Chưa có';

  const titleText = `<a:trangtrig2:1546040703375904801> **TICKET #${ticketNumber}** <a:trangtrig3:1546040818261954610>`;

  const bodyLines = [
    `Chào ${userMention}, cảm ơn bạn đã tạo ticket! <a:heartg1:1545307544808071258>`,
    '',
    `<a:1_:1563484001765949550> Lý do mở ticket: ${reason}`,
    `<a:2_:1563484061111156828> Trạng thái: **${status}**`,
    `<a:3_:1563484342779388045> Support: ${staffMention}`,
    `<a:4_:1563484724725424209> Thời gian tạo ticket: <t:${ts}:F> (<t:${ts}:R>)`,
  ].join('\n');

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${titleText}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(bodyLines)
    );

  if (hasImage) {
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    );
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL('attachment://ticket.png')
      )
    );
  }

  if (showButtons) {
    const row = buildTicketControlRow({ claimedBy });
    container.addActionRowComponents(row);
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

export function buildTicketOpenFallbackEmbed({
  ticketNumber,
  member,
  reason,
  status = 'Đang mở',
  assignedStaff = null,
  createdTimestamp = null,
  claimedBy = null,
  hasImage = false,
  showButtons = true,
}) {
  const ts = createdTimestamp || Math.floor(Date.now() / 1000);
  const userMention = member?.toString?.() || 'bạn';
  const staffMention = assignedStaff
    ? (typeof assignedStaff === 'string' ? assignedStaff : assignedStaff.toString())
    : 'Chưa có';

  const bodyLines = [
    `Chào ${userMention}, cảm ơn bạn đã tạo ticket! <a:heartg1:1545307544808071258>`,
    '',
    `<a:1_:1563484001765949550> Lý do mở ticket: ${reason}`,
    `<a:2_:1563484061111156828> Trạng thái: **${status}**`,
    `<a:3_:1563484342779388045> Support: ${staffMention}`,
    `<a:4_:1563484724725424209> Thời gian tạo ticket: <t:${ts}:F> (<t:${ts}:R>)`,
  ].join('\n');

  const embed = createEmbed({
    title: `TICKET #${ticketNumber}`,
    description: bodyLines,
    color: '#FFB6C9',
  });

  if (hasImage) {
    embed.setImage('attachment://ticket.png');
  }

  const components = showButtons ? [buildTicketControlRow({ claimedBy })] : [];

  return {
    embeds: [embed],
    components,
  };
}


/**
 * =========================================================
 * GET USER TICKET COUNT
 * =========================================================
 */

export const getUserTicketCount =
  wrapServiceBoundary(
    async function getUserTicketCount(
      guildId,
      userId,
    ) {
      return await getOpenTicketCountForUser(
        guildId,
        userId,
      );
    },

    {
      service:
        TICKET_SERVICE,

      operation:
        'getUserTicketCount',

      userMessage:
        'Failed to count open tickets.',

      context: {},
    },
  );


/**
 * =========================================================
 * AUTO SELECT STAFF
 * =========================================================
 */

async function selectTicketStaff(
  guild,
  staffRoleId,
) {
  if (!staffRoleId) {
    return null;
  }

  const staffRole =
    guild.roles.cache.get(
      staffRoleId,
    ) ||
    await guild.roles
      .fetch(
        staffRoleId,
      )
      .catch(
        () =>
          null,
      );

  if (!staffRole) {
    return null;
  }

  const staffMembers =
    [
      ...staffRole.members.values(),
    ]
      .filter(
        member =>
          !member.user.bot,
      );

  if (
    !staffMembers.length
  ) {
    return null;
  }

  const staffLoads =
    await Promise.all(
      staffMembers.map(
        async member => ({
          member,

          ticketCount:
            await getOpenTicketCountForStaff(
              guild.id,
              member.id,
            ),
        }),
      ),
    );

  staffLoads.sort(
    (
      a,
      b,
    ) => {
      if (
        a.ticketCount !==
        b.ticketCount
      ) {
        return (
          a.ticketCount -
          b.ticketCount
        );
      }

      return a.member.id
        .localeCompare(
          b.member.id,
        );
    },
  );

  return (
    staffLoads[0]
      .member
  );
}


/**
 * =========================================================
 * CREATE TICKET
 * =========================================================
 */

export async function createTicket(
  guild,
  member,
  categoryId,
  reason = 'No reason provided',
) {
  try {
    const config =
      await getGuildConfig(
        guild.client,
        guild.id,
      );

    const ticketConfig =
      config.tickets ||
      {};

    const maxTicketsPerUser =
      config.maxTicketsPerUser ??
      3;

    const UNLIMITED_TICKET_ROLE_ID = '1545295139390619768';
    const isUnlimitedTicketMember =
      member?.roles?.cache?.has?.(UNLIMITED_TICKET_ROLE_ID) ||
      (Array.isArray(member?.roles) && member.roles.includes(UNLIMITED_TICKET_ROLE_ID)) ||
      (guild?.members?.cache?.get?.(member?.id)?.roles?.cache?.has?.(UNLIMITED_TICKET_ROLE_ID));

    if (!isUnlimitedTicketMember) {
      const currentTicketCount =
        await getUserTicketCount(
          guild.id,
          member.id,
        );

      if (
        currentTicketCount >=
        maxTicketsPerUser
      ) {
        ticketUserError(
          `Max open tickets reached for ${member.id}`,

          `You have reached the maximum number of open tickets (${maxTicketsPerUser}). Please close your existing tickets before creating a new one.`,

          ErrorTypes.VALIDATION,

          {
            guildId:
              guild.id,

            userId:
              member.id,

            operation:
              'createTicket',
          },
        );
      }
    }


    let category =
      categoryId
        ? guild.channels.cache.get(
            categoryId,
          )
        : guild.channels.cache.find(
            channel =>
              channel.type ===
                ChannelType.GuildCategory &&
              channel.name
                .toLowerCase()
                .includes(
                  'tickets',
                ),
          );


    if (
      !category &&
      !categoryId
    ) {
      category =
        await guild.channels.create(
          {
            name:
              'Tickets',

            type:
              ChannelType.GuildCategory,

            permissionOverwrites: [
              {
                id:
                  guild.id,

                deny: [
                  PermissionFlagsBits.ViewChannel,
                ],
              },
            ],
          },
        );
    }


    const ticketNumber =
      await getNextTicketNumber(
        guild.id,
      );


    let channelName =
      `ticket-${ticketNumber}`;



    const channel =
      await guild.channels.create(
        {
          name:
            channelName,

          type:
            ChannelType.GuildText,

          parent:
            category?.id,

          permissionOverwrites: [
            {
              id:
                guild.id,

              deny: [
                PermissionFlagsBits.ViewChannel,
              ],
            },

            {
              id:
                member.id,

              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },

            ...(
              config.ticketStaffRoleId
                ? [
                    {
                      id:
                        config.ticketStaffRoleId,

                      allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.ReadMessageHistory,
                      ],
                    },
                  ]
                : []
            ),
          ],
        },
      );


    const assignedStaff =
      await selectTicketStaff(
        guild,
        config.ticketStaffRoleId,
      );


    const ticketData = {
      id:
        channel.id,

      userId:
        member.id,

      guildId:
        guild.id,

      createdAt:
        new Date()
          .toISOString(),

      status:
        'open',

      claimedBy:
        assignedStaff?.id ??
        null,

      claimedAt:
        assignedStaff
          ? new Date()
              .toISOString()
          : null,


      reason,
      number: ticketNumber,
    };

    await saveTicketData(
      guild.id,
      channel.id,
      ticketData,
    );

    const ticketAttachment = getTicketImageAttachment();
    const ticketFiles = ticketAttachment ? [ticketAttachment] : [];

    const staffMention =
      assignedStaff
        ? ` ${assignedStaff.toString()}`
        : config.ticketStaffRoleId
          ? ` <@&${config.ticketStaffRoleId}>`
          : '';

    const messageContent =
      `${member.toString()}${staffMention}`.trim();

    if (messageContent) {
      await channel.send({
        content: messageContent,
      }).catch(err => {
        logger.warn('[Ticket] Failed to send ticket ping message:', err);
      });
    }

    const createdTs = Math.floor(Date.now() / 1000);

    let ticketMessage;
    try {
      const v2Payload = buildTicketOpenPayload({
        ticketNumber,
        member,
        reason,
        status: 'Đang mở',
        assignedStaff,
        createdTimestamp: createdTs,
        claimedBy: assignedStaff?.id ?? null,
        hasImage: Boolean(ticketAttachment),
      });

      ticketMessage = await channel.send({
        ...v2Payload,
        files: ticketFiles,
      });
    } catch (v2Error) {
      logger.warn('[Ticket] Failed to send V2 container for open ticket, falling back to embed:', v2Error);
      const fallbackPayload = buildTicketOpenFallbackEmbed({
        ticketNumber,
        member,
        reason,
        status: 'Đang mở',
        assignedStaff,
        createdTimestamp: createdTs,
        claimedBy: assignedStaff?.id ?? null,
        hasImage: Boolean(ticketAttachment),
      });
      ticketMessage = await channel.send({
        ...fallbackPayload,
        files: ticketFiles,
      });
    }

    ticketData.messageId = ticketMessage.id;
    await saveTicketData(
      guild.id,
      channel.id,
      ticketData,
    );

    await ticketMessage
      .pin()
      .catch(
        () => {},
      );


    await logTicketEvent(
      {
        client:
          guild.client,

        guildId:
          guild.id,

        event: {
          type:
            'open',

          ticketId:
            channel.id,

          ticketNumber,

          userId:
            member.id,

          executorId:
            member.id,

          reason,



          metadata: {
            channelId:
              channel.id,

            categoryName:
              category?.name ||
              'Default',
          },
        },
      },
    );


    return {
      channel,
      ticketData,
    };

  } catch (error) {
    rethrowTicketError(
      error,

      'createTicket',

      'Failed to create ticket. Please try again in a moment.',

      {
        guildId:
          guild?.id,

        userId:
          member?.id,
      },
    );
  }
}

/**
 * =========================================================
 * FETCH TICKET EMBED MESSAGE (OPTIMIZED)
 * =========================================================
 */
async function fetchTicketMessage(channel, ticketData) {
  if (ticketData?.messageId) {
    const directMessage = await channel.messages.fetch(ticketData.messageId).catch(() => null);
    if (directMessage) {
      return directMessage;
    }
  }

  // Luôn giới hạn nhỏ nhất ({ limit: 5 }) thay vì fetch 50 tin nhắn mặc định để tiết kiệm tối đa Egress & RAM
  const messages = await channel.messages.fetch({ limit: 5 }).catch(() => null);
  const found = messages?.find(
    message =>
      message.embeds?.length > 0 &&
      message.embeds[0].title?.startsWith('Ticket #'),
  );

  if (found && ticketData) {
    ticketData.messageId = found.id;
    await saveTicketData(channel.guild.id, channel.id, ticketData).catch(() => null);
  }

  return found || null;
}

/**
 * =========================================================
 * CLOSE TICKET
 * =========================================================
 */

export async function closeTicket(
  channel,
  closer,
  reason = 'No reason provided',
) {
  try {
    const ticketData =
      requireTicket(
        await getTicketData(
          channel.guild.id,
          channel.id,
        ),

        channel,
      );


    const config =
      await getGuildConfig(
        channel.client,
        channel.guild.id,
      );


    const closedCategoryId =
      config.ticketClosedCategoryId ||
      null;


    let movedToClosedCategory =
      false;

    let dmSent =
      false;


    /**
     * =====================================================
     * SAVE CLOSED STATUS
     * =====================================================
     */

    ticketData.status =
      'closed';

    ticketData.closedBy =
      closer.id;

    ticketData.closedAt =
      new Date()
        .toISOString();

    ticketData.closeReason =
      reason;


    await saveTicketData(
      channel.guild.id,
      channel.id,
      ticketData,
    );


    /**
     * =====================================================
     * MOVE TO CLOSED CATEGORY
     * =====================================================
     */

    if (
      closedCategoryId &&
      channel.parentId !==
        closedCategoryId
    ) {
      const closedCategory =
        channel.guild.channels.cache.get(
          closedCategoryId,
        ) ||
        await channel.guild.channels
          .fetch(
            closedCategoryId,
          )
          .catch(
            () =>
              null,
          );


      if (
        closedCategory?.type ===
        ChannelType.GuildCategory
      ) {
        try {
          await channel.setParent(
            closedCategoryId,
            {
              lockPermissions:
                false,
            },
          );

          movedToClosedCategory =
            true;

        } catch (moveError) {
          logger.warn(
            `Could not move ticket ${channel.id} to closed category ${closedCategoryId}: ${moveError.message}`,
          );
        }

      } else {
        logger.warn(
          `Configured closed category is invalid for guild ${channel.guild.id}: ${closedCategoryId}`,
        );
      }
    }


    /**
     * =====================================================
     * FEEDBACK DM
     * =====================================================
     *
     * FIX:
     *
     * - Không còn dùng TICKET_IMAGE_URL.
     * - Dùng assets/ticket/ticket.png.
     * - Tôn trọng setting dmOnClose.
     */

    if (
      config.dmOnClose !==
      false
    ) {
      try {
        let ticketCreator =
          null;


        try {
          ticketCreator =
            await channel.client.users.fetch(
              ticketData.userId,
            );

        } catch (fetchError) {
          logger.warn(
            `Could not fetch ticket creator ${ticketData.userId} for feedback DM: ${fetchError.message}`,
          );
        }


        if (
          ticketCreator
        ) {
          try {
            const feedbackAttachment = getTicketImageAttachment();
            const feedbackFiles = feedbackAttachment ? [feedbackAttachment] : [];
            const ticketNum = ticketData.number || ticketData.ticketNumber || (channel.name.match(/\d+/) ? channel.name.match(/\d+/)[0] : channel.name);

            let staffMention = 'SP Ticket';
            if (ticketData.claimedBy) {
              staffMention = `<@${ticketData.claimedBy}>`;
            } else if (closer && closer !== ticketData.userId && closer !== `<@${ticketData.userId}>`) {
              staffMention = typeof closer === 'string' ? closer : closer.toString();
            }

            const nowTs = Math.floor(Date.now() / 1000);
            const feedbackTitle = `<a:trangtrig2:1546040703375904801> **TICKET FEEDBACK** <a:trangtrig3:1546040818261954610>`;
            const feedbackLines = [
              `Ticket #${ticketNum} của bạn đã được đóng bởi ${staffMention}.`,
              '',
              `<a:heartg3:1546047728314884226> Bọn mình rất muốn biết trải nghiệm của bạn vừa rồi như thế nào, bạn cảm thấy ổn không về hỗ trợ vừa rồi?`,
              '',
              `<a:heartg3:1546047728314884226> Nếu mọi thứ đều tốt, xin hãy đánh giá giúp bọn mình nhé! Mỗi một đánh giá của bạn sẽ giúp bọn mình cải thiện chất lượng hỗ trợ tốt hơn ạ.`,
              '',
              `*Bọn mình xin cảm ơn!*`,
              '',
              `<a:trangtrig41:1547238037832863744> **Thời gian:** <t:${nowTs}:F>`,
            ].join('\n');

            const base = `ticket_feedback:${channel.guild.id}:${channel.id}`;

            const starsRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`${base}:1`)
                .setLabel('⭐ 1')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`${base}:2`)
                .setLabel('⭐ 2')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`${base}:3`)
                .setLabel('⭐ 3')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`${base}:4`)
                .setLabel('⭐ 4')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`${base}:5`)
                .setLabel('⭐ 5')
                .setStyle(ButtonStyle.Secondary),
            );

            const declineRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`ticket_feedback_comment:${channel.guild.id}:${channel.id}`)
                .setLabel('Viết nhận xét')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`ticket_feedback_decline:${channel.guild.id}:${channel.id}`)
                .setLabel('Không, cảm ơn')
                .setStyle(ButtonStyle.Secondary),
            );

            try {
              const feedbackContainer = new ContainerBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`# ${feedbackTitle}`)
                )
                .addSeparatorComponents(
                  new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(feedbackLines)
                );

              if (feedbackAttachment) {
                feedbackContainer.addSeparatorComponents(
                  new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
                );
                feedbackContainer.addMediaGalleryComponents(
                  new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL('attachment://ticket.png')
                  )
                );
              }

              feedbackContainer.addActionRowComponents(starsRow, declineRow);

              await ticketCreator.send({
                components: [feedbackContainer],
                files: feedbackFiles,
                flags: MessageFlags.IsComponentsV2,
              });
            } catch (v2SendErr) {
              logger.warn('Failed to send feedback DM as Components V2, falling back to embed:', v2SendErr);
              const feedbackEmbed = createEmbed({
                title: 'TICKET FEEDBACK',
                description: feedbackLines,
                color: '#F1C40F',
                image: feedbackAttachment ? { url: 'attachment://ticket.png' } : undefined,
              });

              await ticketCreator.send({
                embeds: [feedbackEmbed],
                files: feedbackFiles,
                components: [starsRow, declineRow],
              });
            }


            dmSent =
              true;


            logger.info(
              `Feedback survey sent to ticket creator ${ticketData.userId}`,
            );

          } catch (feedbackError) {
            logger.warn(
              `Could not send feedback survey to ticket creator ${ticketData.userId}: ${feedbackError.message}`,
            );
          }
        }

      } catch (dmError) {
        logger.warn(
          `Could not send DM to ticket creator ${ticketData.userId}: ${dmError.message}`,
        );
      }

    } else {
      logger.info(
        `DM on Close disabled for guild ${channel.guild.id}; skipping ticket feedback DM.`,
      );
    }


    /**
     * =====================================================
     * REMOVE CREATOR ACCESS
     * =====================================================
     */

    try {
      const user =
        await channel.guild.members
          .fetch(
            ticketData.userId,
          )
          .catch(
            () =>
              null,
          );


      const targetUser =
        user?.user ||
        await channel.client.users
          .fetch(
            ticketData.userId,
          )
          .catch(
            () =>
              null,
          );


      if (
        targetUser
      ) {
        const overwrite =
          channel.permissionOverwrites.cache.get(
            ticketData.userId,
          );


        if (
          overwrite
        ) {
          await overwrite.edit(
            {
              ViewChannel:
                false,

              SendMessages:
                false,
            },
          );

        } else {
          await channel.permissionOverwrites.create(
            targetUser,

            {
              ViewChannel:
                false,

              SendMessages:
                false,
            },
          );
        }
      }

    } catch (permError) {
      logger.warn(
        `Could not update user permissions for closed ticket: ${permError.message}`,
      );
    }


    /**
     * =====================================================
     * UPDATE ORIGINAL TICKET MESSAGE
     * =====================================================
     */

    const ticketMessage =
      await fetchTicketMessage(
        channel,
        ticketData,
      );


    if (
      ticketMessage
    ) {
      const creator = channel.guild.members.cache.get(ticketData.userId) || `<@${ticketData.userId}>`;
      const createdAt = ticketData.createdAt ? Math.floor(new Date(ticketData.createdAt).getTime() / 1000) : null;
      const staff = ticketData.claimedBy ? `<@${ticketData.claimedBy}>` : null;
      const ticketAttachment = getTicketImageAttachment();
      const num = ticketData.number || ticketData.ticketNumber || (channel.name.match(/\d+/) ? channel.name.match(/\d+/)[0] : '???');
      const isV2 = ticketMessage.flags?.has(MessageFlags.IsComponentsV2) || (!ticketMessage.embeds?.length && ticketMessage.components?.length > 0);

      if (isV2) {
        try {
          const v2Payload = buildTicketOpenPayload({
            ticketNumber: num,
            member: creator,
            reason: ticketData.reason || 'No reason provided',
            status: 'Đã đóng',
            assignedStaff: staff,
            createdTimestamp: createdAt,
            claimedBy: ticketData.claimedBy,
            hasImage: Boolean(ticketAttachment),
            showButtons: false,
          });

          await ticketMessage.edit({
            embeds: [],
            ...v2Payload,
          });
        } catch (closeEditError) {
          logger.warn('Failed to update ticketMessage on close as V2:', closeEditError);
          await ticketMessage.edit({ components: [] }).catch(() => {});
        }
      } else {
        try {
          const fallbackPayload = buildTicketOpenFallbackEmbed({
            ticketNumber: num,
            member: creator,
            reason: ticketData.reason || 'No reason provided',
            status: 'Đã đóng',
            assignedStaff: staff,
            createdTimestamp: createdAt,
            claimedBy: ticketData.claimedBy,
            hasImage: Boolean(ticketAttachment),
            showButtons: false,
          });

          await ticketMessage.edit({
            ...fallbackPayload,
            components: [],
          });
        } catch (closeEditError) {
          logger.warn('Failed to update ticketMessage on close as fallback embed:', closeEditError);
          await ticketMessage.edit({ components: [] }).catch(() => {});
        }
      }
    }


    /**
     * =====================================================
     * CLOSED MESSAGE
     * =====================================================
     */

    const closeTitleText = `<a:trangtrig2:1546040703375904801> **TICKET CLOSED** <a:trangtrig3:1546040818261954610>`;
    const closeBody = [
      `Ticket này đã được đóng bởi ${closer}.`,
      `<a:trangtrig18:1546068102817775626> Lý do: ${reason}`,
      `<a:trangtrig18:1546068102817775626> Ticket ID: ${ticketData.id}`,
    ].join('\n');

    const controlRow =
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_reopen')
            .setLabel('Mở lại ticket')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('<a:trangtrig20:1546092997299667055>'),

          new ButtonBuilder()
            .setCustomId('ticket_delete')
            .setLabel('Xóa ticket')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('<a:trangtrig20:1546092997299667055>'),
        );

    try {
      const closeContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`# ${closeTitleText}`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(closeBody)
        )
        .addActionRowComponents(controlRow);

      await channel.send({
        components: [closeContainer],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (v2CloseErr) {
      logger.warn('Failed to send close message as V2 container, falling back:', v2CloseErr);
      const closeEmbed = createEmbed({
        title: '🔒 TICKET CLOSED',
        description: closeBody,
        color: '#e74c3c',
      });

      await channel.send({
        embeds: [closeEmbed],
        components: [controlRow],
      });
    }


    /**
     * =====================================================
     * LOG CLOSE
     * =====================================================
     */

    await logTicketEvent(
      {
        client:
          channel.client,

        guildId:
          channel.guild.id,

        event: {
          type:
            'close',

          ticketId:
            channel.id,

          ticketNumber:
            ticketData.id,

          userId:
            ticketData.userId,

          executorId:
            closer.id,

          reason,

          metadata: {
            dmSent,

            closedAt:
              ticketData.closedAt,

            movedToClosedCategory,
          },
        },
      },
    );


    return ticketData;

  } catch (error) {
    rethrowTicketError(
      error,

      'closeTicket',

      'Failed to close ticket. Please try again in a moment.',

      {
        guildId:
          channel?.guild?.id,

        channelId:
          channel?.id,

        closerId:
          closer?.id,
      },
    );
  }
}


/**
 * =========================================================
 * CLAIM TICKET
 * =========================================================
 */

export async function claimTicket(
  channel,
  claimer,
) {
  try {
    const ticketData =
      requireTicket(
        await getTicketData(
          channel.guild.id,
          channel.id,
        ),

        channel,
      );


    if (
      ticketData.claimedBy
    ) {
      ticketUserError(
        'Ticket already claimed',

        `This ticket is already claimed by <@${ticketData.claimedBy}>`,

        ErrorTypes.VALIDATION,

        {
          channelId:
            channel.id,

          claimedBy:
            ticketData.claimedBy,

          operation:
            'claimTicket',
        },
      );
    }


    ticketData.claimedBy =
      claimer.id;

    ticketData.claimedAt =
      new Date()
        .toISOString();


    await saveTicketData(
      channel.guild.id,
      channel.id,
      ticketData,
    );


    const ticketMessage =
      await fetchTicketMessage(
        channel,
        ticketData,
      );


    if (
      ticketMessage
    ) {
      const creator = channel.guild.members.cache.get(ticketData.userId) || `<@${ticketData.userId}>`;
      const createdAt = ticketData.createdAt ? Math.floor(new Date(ticketData.createdAt).getTime() / 1000) : null;
      const ticketAttachment = getTicketImageAttachment();
      const num = ticketData.number || ticketData.ticketNumber || (channel.name.match(/\d+/) ? channel.name.match(/\d+/)[0] : '???');
      const isV2 = ticketMessage.flags?.has(MessageFlags.IsComponentsV2) || (!ticketMessage.embeds?.length && ticketMessage.components?.length > 0);

      if (isV2) {
        try {
          const v2Payload = buildTicketOpenPayload({
            ticketNumber: num,
            member: creator,
            reason: ticketData.reason || 'No reason provided',
            status: 'Đang mở',
            assignedStaff: claimer,
            createdTimestamp: createdAt,
            claimedBy: claimer.id,
            hasImage: Boolean(ticketAttachment),
            showButtons: true,
          });

          await ticketMessage.edit({
            embeds: [],
            ...v2Payload,
          });
        } catch (editError) {
          logger.warn('Failed to edit ticketMessage as V2 container on claim, trying fallback:', editError);
          const row = buildTicketControlRow({ claimedBy: claimer.id });
          await ticketMessage.edit({ components: [row] }).catch(() => {});
        }
      } else {
        try {
          const fallbackPayload = buildTicketOpenFallbackEmbed({
            ticketNumber: num,
            member: creator,
            reason: ticketData.reason || 'No reason provided',
            status: 'Đang mở',
            assignedStaff: claimer,
            createdTimestamp: createdAt,
            claimedBy: claimer.id,
            hasImage: Boolean(ticketAttachment),
            showButtons: true,
          });

          await ticketMessage.edit(fallbackPayload);
        } catch (editError) {
          logger.warn('Failed to edit fallback embed on claim:', editError);
          const row = buildTicketControlRow({ claimedBy: claimer.id });
          await ticketMessage.edit({ components: [row] }).catch(() => {});
        }
      }
    }


    const claimEmbed =
      createEmbed(
        {
          title:
            'Ticket Claimed',

          description:
            `🎉 ${claimer} has claimed this ticket!`,

          color:
            '#2ecc71',
        },
      );


    const unclaimRow =
      new ActionRowBuilder()
        .addComponents(

          new ButtonBuilder()
            .setCustomId(
              'ticket_unclaim',
            )
            .setLabel(
              'Unclaim',
            )
            .setStyle(
              ButtonStyle.Secondary,
            )
            .setEmoji(
              '🔓',
            ),
        );


    const claimStatusMessage =
      messages.find(
        message =>
          message.embeds.length >
            0 &&
          (
            message.embeds[0].title ===
              'Ticket Claimed' ||
            message.embeds[0].title ===
              'Ticket Unclaimed'
          ),
      );


    if (
      claimStatusMessage
    ) {
      await claimStatusMessage.edit(
        {
          embeds: [
            claimEmbed,
          ],

          components: [
            unclaimRow,
          ],
        },
      );

    } else {
      await channel.send(
        {
          embeds: [
            claimEmbed,
          ],

          components: [
            unclaimRow,
          ],
        },
      );
    }


    await logTicketEvent(
      {
        client:
          channel.client,

        guildId:
          channel.guild.id,

        event: {
          type:
            'claim',

          ticketId:
            channel.id,

          ticketNumber:
            ticketData.id,

          userId:
            ticketData.userId,

          executorId:
            claimer.id,

          metadata: {
            claimedAt:
              ticketData.claimedAt,
          },
        },
      },
    );


    return ticketData;

  } catch (error) {
    rethrowTicketError(
      error,

      'claimTicket',

      'Failed to claim ticket. Please try again in a moment.',

      {
        guildId:
          channel?.guild?.id,

        channelId:
          channel?.id,

        claimerId:
          claimer?.id,
      },
    );
  }
}


/**
 * =========================================================
 * REOPEN TICKET
 * =========================================================
 */

export async function reopenTicket(
  channel,
  reopener,
) {
  try {
    const ticketData =
      requireTicket(
        await getTicketData(
          channel.guild.id,
          channel.id,
        ),

        channel,
      );


    if (
      ticketData.status !==
      'closed'
    ) {
      ticketUserError(
        'Ticket not closed',

        'This ticket is not currently closed.',

        ErrorTypes.VALIDATION,

        {
          channelId:
            channel.id,

          operation:
            'reopenTicket',
        },
      );
    }


    const config =
      await getGuildConfig(
        channel.client,
        channel.guild.id,
      );


    const openCategoryId =
      config.ticketCategoryId ||
      null;


    let movedToOpenCategory =
      false;

    let openCategoryMoveFailed =
      false;


    ticketData.status =
      'open';

    ticketData.closedBy =
      null;

    ticketData.closedAt =
      null;

    ticketData.closeReason =
      null;


    await saveTicketData(
      channel.guild.id,
      channel.id,
      ticketData,
    );


    if (
      openCategoryId &&
      channel.parentId !==
        openCategoryId
    ) {
      const openCategory =
        channel.guild.channels.cache.get(
          openCategoryId,
        ) ||
        await channel.guild.channels
          .fetch(
            openCategoryId,
          )
          .catch(
            () =>
              null,
          );


      if (
        openCategory?.type ===
        ChannelType.GuildCategory
      ) {
        try {
          await channel.setParent(
            openCategoryId,
            {
              lockPermissions:
                false,
            },
          );

          movedToOpenCategory =
            true;

        } catch (moveError) {
          openCategoryMoveFailed =
            true;

          logger.warn(
            `Could not move reopened ticket ${channel.id} to open category ${openCategoryId}: ${moveError.message}`,
          );
        }

      } else {
        openCategoryMoveFailed =
          true;

        logger.warn(
          `Configured open ticket category is invalid for guild ${channel.guild.id}: ${openCategoryId}`,
        );
      }
    }


    try {
      const user =
        await channel.guild.members
          .fetch(
            ticketData.userId,
          )
          .catch(
            () =>
              null,
          );


      if (
        user
      ) {
        await channel.permissionOverwrites.create(
          user,

          {
            ViewChannel:
              true,

            SendMessages:
              true,

            ReadMessageHistory:
              true,

            AttachFiles:
              true,
          },
        );
      }

    } catch (error) {
      logger.warn(
        `Could not restore access for user ${ticketData.userId}:`,
        error.message,
      );
    }


    const ticketMessage =
      await fetchTicketMessage(
        channel,
        ticketData,
      );


    if (
      ticketMessage
    ) {
      const creator = channel.guild.members.cache.get(ticketData.userId) || `<@${ticketData.userId}>`;
      const createdAt = ticketData.createdAt ? Math.floor(new Date(ticketData.createdAt).getTime() / 1000) : null;
      const staff = ticketData.claimedBy ? (channel.guild.members.cache.get(ticketData.claimedBy) || `<@${ticketData.claimedBy}>`) : null;
      const ticketAttachment = getTicketImageAttachment();
      const num = ticketData.number || ticketData.ticketNumber || (channel.name.match(/\d+/) ? channel.name.match(/\d+/)[0] : '???');
      const isV2 = ticketMessage.flags?.has(MessageFlags.IsComponentsV2) || (!ticketMessage.embeds?.length && ticketMessage.components?.length > 0);

      if (isV2) {
        try {
          const v2Payload = buildTicketOpenPayload({
            ticketNumber: num,
            member: creator,
            reason: ticketData.reason || 'No reason provided',
            status: 'Đang mở',
            assignedStaff: staff,
            createdTimestamp: createdAt,
            claimedBy: ticketData.claimedBy,
            hasImage: Boolean(ticketAttachment),
            showButtons: true,
          });

          await ticketMessage.edit({
            embeds: [],
            ...v2Payload,
          });
        } catch (editError) {
          logger.warn('Failed to edit ticketMessage as V2 container on reopen, trying fallback:', editError);
          const row = buildTicketControlRow({ claimedBy: ticketData.claimedBy });
          await ticketMessage.edit({ components: [row] }).catch(() => {});
        }
      } else {
        try {
          const fallbackPayload = buildTicketOpenFallbackEmbed({
            ticketNumber: num,
            member: creator,
            reason: ticketData.reason || 'No reason provided',
            status: 'Đang mở',
            assignedStaff: staff,
            createdTimestamp: createdAt,
            claimedBy: ticketData.claimedBy,
            hasImage: Boolean(ticketAttachment),
            showButtons: true,
          });

          await ticketMessage.edit(fallbackPayload);
        } catch (editError) {
          logger.warn('Failed to edit fallback embed on reopen:', editError);
          const row = buildTicketControlRow({ claimedBy: ticketData.claimedBy });
          await ticketMessage.edit({ components: [row] }).catch(() => {});
        }
      }
    }


    const reopenEmbed =
      createEmbed(
        {
          title:
            'Ticket Reopened',

          description:
            `🔓 ${reopener} has reopened this ticket!`,

          color:
            '#2ecc71',
        },
      );


    const closeStatusMessage =
      messages.find(
        message =>
          message.components?.some(
            row =>
              row.components?.some(
                component =>
                  component.customId ===
                  'ticket_reopen',
              ),
          ),
      );


    if (
      closeStatusMessage
    ) {
      if (closeStatusMessage.flags?.has?.(MessageFlags.IsComponentsV2)) {
        const reopenContainer = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# 🔓 **Ticket Reopened**`)
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`🔓 ${reopener} đã mở lại ticket này!`)
          );
        await closeStatusMessage.edit({
          components: [reopenContainer],
          flags: MessageFlags.IsComponentsV2,
        }).catch(err => logger.warn('Failed to edit closeStatusMessage as V2:', err));
      } else {
        await closeStatusMessage.edit(
          {
            embeds: [
              reopenEmbed,
            ],

            components:
              [],
          },
        ).catch(err => logger.warn('Failed to edit closeStatusMessage:', err));
      }

    } else {
      await channel.send(
        {
          embeds: [
            reopenEmbed,
          ],
        },
      );
    }


    return {
      ticketData,
      movedToOpenCategory,
      openCategoryMoveFailed,
    };

  } catch (error) {
    rethrowTicketError(
      error,

      'reopenTicket',

      'Failed to reopen ticket. Please try again in a moment.',

      {
        guildId:
          channel?.guild?.id,

        channelId:
          channel?.id,

        reopenerId:
          reopener?.id,
      },
    );
  }
}


/**
 * =========================================================
 * DELETE TICKET
 * =========================================================
 */

export async function deleteTicket(
  channel,
  deleter,
) {
  try {
    const ticketData =
      requireTicket(
        await getTicketData(
          channel.guild.id,
          channel.id,
        ),

        channel,
      );


    const deleteTitle = `<a:trangtrig2:1546040703375904801> **TICKET DELETE** <a:trangtrig3:1546040818261954610>`;
    const deleteBody = [
      `Kênh ticket này sẽ được xóa vĩnh viễn trong ${TICKET_DELETE_DELAY_SECONDS} giây nữa.`,
      '',
      `Toàn bộ nội dung hội thoại đang được tự động sao lưu thành bản **Transcript HTML + PDF** gửi về kênh lưu trữ.`,
      '',
      `-# Ticket ID: ${ticketData.id}`,
    ].join('\n');

    try {
      const deleteContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`# ${deleteTitle}`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(deleteBody)
        );

      await channel.send({
        components: [deleteContainer],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (v2DeleteErr) {
      logger.warn('Failed to send delete message as V2, falling back:', v2DeleteErr);
      const deleteEmbed = createEmbed({
        title: 'TICKET DELETE',
        description: deleteBody,
        color: '#e74c3c',
        footer: {
          text: `Ticket ID: ${ticketData.id}`,
        },
      });

      await channel.send({
        embeds: [deleteEmbed],
      });
    }


    await logTicketEvent(
      {
        client:
          channel.client,

        guildId:
          channel.guild.id,

        event: {
          type:
            'delete',

          ticketId:
            channel.id,

          ticketNumber:
            ticketData.id,

          userId:
            ticketData.userId,

          executorId:
            deleter.id,

          metadata: {
            deletedAt:
              new Date()
                .toISOString(),
          },
        },
      },
    );


    setTimeout(
      async () => {
        try {
          logger.debug(
            'Starting ticket deletion process',
            {
              channelId:
                channel.id,

              ticketId:
                ticketData.id,
            },
          );


          let transcriptFiles =
            [];


          try {
            transcriptFiles =
              await generateTranscriptFiles(
                channel,
                ticketData,
              );


            if (transcriptFiles.length > 0) {
              logger.info(
                'Transcript generated successfully, attempting to send',
                {
                  channelId:
                    channel.id,

                  ticketNumber:
                    ticketData.id,
                },
              );

            } else {
              logger.warn(
                'Transcript generation returned null',
                {
                  channelId:
                    channel.id,

                  ticketNumber:
                    ticketData.id,
                },
              );
            }

          } catch (transcriptError) {
            logger.error(
              'Error during transcript generation',
              {
                channelId:
                  channel.id,

                ticketNumber:
                  ticketData.id,

                error:
                  transcriptError.message,
              },
            );
          }


          if (transcriptFiles.length > 0) {
            try {
              const guildConfig =
                await getGuildConfig(
                  channel.client,
                  channel.guild.id,
                );


              if (
                !guildConfig.ticketTranscriptChannelId
              ) {
                logger.warn(
                  'No transcript channel configured, skipping transcript send',
                  {
                    channelId:
                      channel.id,

                    ticketNumber:
                      ticketData.id,
                  },
                );

              } else {
                const transcriptChannel =
                  await channel.client.channels
                    .fetch(
                      guildConfig.ticketTranscriptChannelId,
                    )
                    .catch(
                      () =>
                        null,
                    );


                if (
                  !transcriptChannel
                ) {
                  logger.error(
                    'Could not fetch transcript channel',
                    {
                      channelId:
                        channel.id,

                      transcriptChannelId:
                        guildConfig.ticketTranscriptChannelId,
                    },
                  );

                } else if (
                  !transcriptChannel.isSendable()
                ) {
                  logger.error(
                    'Transcript channel exists but is not sendable',
                    {
                      channelId:
                        channel.id,

                      transcriptChannelId:
                        transcriptChannel.id,
                    },
                  );

                } else {
                  const ticketNum = ticketData.number || ticketData.ticketNumber || (channel.name.match(/\d+/) ? channel.name.match(/\d+/)[0] : (ticketData.id || channel.name));
                  const nowTs = Math.floor(Date.now() / 1000);
                  const deleterMention = deleter ? `<@${deleter.id || deleter}>` : 'Unknown';

                  const transcriptLines = [
                    `<a:trangtrig31:1546905996893626440> **Ticket:** #${ticketNum}`,
                    `<a:trangtrig31:1546905996893626440> **Thời gian xuất transcript:** <t:${nowTs}:F>`,
                    `<a:trangtrig31:1546905996893626440> **Deleted by:** ${deleterMention}`,
                  ].join('\n');

                  const transcriptEmbed = createEmbed({
                    title: 'TICKET TRANSCRIPT',
                    description: transcriptLines,
                    color: 0x3498db,
                  });

                  await transcriptChannel.send({
                    embeds: [transcriptEmbed],
                    files: transcriptFiles,
                  });


                  logger.info(
                    '✅ Transcript sent successfully',
                    {
                      channelId:
                        channel.id,

                      ticketNumber:
                        ticketData.id,

                      transcriptChannelId:
                        transcriptChannel.id,
                    },
                  );
                }
              }

            } catch (sendError) {
              logger.error(
                'Failed to send transcript to channel:',
                {
                  channelId:
                    channel.id,

                  ticketNumber:
                    ticketData.id,

                  error:
                    sendError.message,
                },
              );
            }
          }


          try {
            await channel.delete(
              'Ticket deleted permanently',
            );


            logger.info(
              '✅ Channel deleted',
              {
                channelId:
                  channel.id,

                channelName:
                  channel.name,

                ticketNumber:
                  ticketData.id,
              },
            );

          } catch (deleteError) {
            logger.error(
              '❌ Failed to delete ticket channel:',
              {
                channelId:
                  channel.id,

                channelName:
                  channel.name,

                ticketNumber:
                  ticketData.id,

                errorMessage:
                  deleteError.message,

                errorCode:
                  deleteError.code,

                errorName:
                  deleteError.name,
              },
            );
          }

        } catch (error) {
          logger.error(
            '❌ Unexpected error during ticket deletion:',
            {
              channelId:
                channel.id,

              channelName:
                channel?.name,

              ticketNumber:
                ticketData?.id,

              errorMessage:
                error.message,

              errorName:
                error.name,

              errorStack:
                error.stack,
            },
          );
        }
      },

      TICKET_DELETE_DELAY_MS,
    );


    return ticketData;

  } catch (error) {
    rethrowTicketError(
      error,

      'deleteTicket',

      'Failed to delete ticket. Please try again in a moment.',

      {
        guildId:
          channel?.guild?.id,

        channelId:
          channel?.id,

        deleterId:
          deleter?.id,
      },
    );
  }
}


/**
 * =========================================================
 * UNCLAIM TICKET
 * =========================================================
 */

export async function unclaimTicket(
  channel,
  unclaimer,
) {
  try {
    const ticketData =
      requireTicket(
        await getTicketData(
          channel.guild.id,
          channel.id,
        ),

        channel,
      );


    if (
      !ticketData.claimedBy
    ) {
      ticketUserError(
        'Ticket not claimed',

        'This ticket is not currently claimed.',

        ErrorTypes.VALIDATION,

        {
          channelId:
            channel.id,

          operation:
            'unclaimTicket',
        },
      );
    }


    if (
      ticketData.claimedBy !==
        unclaimer.id &&
      !unclaimer.permissions.has(
        PermissionFlagsBits.ManageChannels,
      )
    ) {
      ticketUserError(
        'Cannot unclaim ticket',

        'You can only unclaim your own tickets or need Manage Channels permission.',

        ErrorTypes.PERMISSION,

        {
          channelId:
            channel.id,

          operation:
            'unclaimTicket',
        },
      );
    }


    const previousClaimer =
      ticketData.claimedBy;


    ticketData.claimedBy =
      null;

    ticketData.claimedAt =
      null;


    await saveTicketData(
      channel.guild.id,
      channel.id,
      ticketData,
    );


    const ticketMessage =
      await fetchTicketMessage(
        channel,
        ticketData,
      );


    if (
      ticketMessage
    ) {
      const creator = channel.guild.members.cache.get(ticketData.userId) || `<@${ticketData.userId}>`;
      const createdAt = ticketData.createdAt ? Math.floor(new Date(ticketData.createdAt).getTime() / 1000) : null;
      const ticketAttachment = getTicketImageAttachment();
      const num = ticketData.number || ticketData.ticketNumber || (channel.name.match(/\d+/) ? channel.name.match(/\d+/)[0] : '???');
      const isV2 = ticketMessage.flags?.has(MessageFlags.IsComponentsV2) || (!ticketMessage.embeds?.length && ticketMessage.components?.length > 0);

      if (isV2) {
        try {
          const v2Payload = buildTicketOpenPayload({
            ticketNumber: num,
            member: creator,
            reason: ticketData.reason || 'No reason provided',
            status: 'Đang mở',
            assignedStaff: null,
            createdTimestamp: createdAt,
            claimedBy: null,
            hasImage: Boolean(ticketAttachment),
            showButtons: true,
          });

          await ticketMessage.edit({
            embeds: [],
            ...v2Payload,
          });
        } catch (editError) {
          logger.warn('Failed to edit ticketMessage as V2 container on unclaim, trying fallback:', editError);
          const row = buildTicketControlRow();
          await ticketMessage.edit({ components: [row] }).catch(() => {});
        }
      } else {
        try {
          const fallbackPayload = buildTicketOpenFallbackEmbed({
            ticketNumber: num,
            member: creator,
            reason: ticketData.reason || 'No reason provided',
            status: 'Đang mở',
            assignedStaff: null,
            createdTimestamp: createdAt,
            claimedBy: null,
            hasImage: Boolean(ticketAttachment),
            showButtons: true,
          });

          await ticketMessage.edit(fallbackPayload);
        } catch (editError) {
          logger.warn('Failed to edit fallback embed on unclaim:', editError);
          const row = buildTicketControlRow();
          await ticketMessage.edit({ components: [row] }).catch(() => {});
        }
      }
    }


    const claimMessage =
      messages.find(
        message =>
          message.embeds.length >
            0 &&
          (
            message.embeds[0].title ===
              'Ticket Claimed' ||
            message.embeds[0].title ===
              'Ticket Unclaimed'
          ),
      );


    const unclaimEmbed =
      createEmbed(
        {
          title:
            'Ticket Unclaimed',

          description:
            `🔓 ${unclaimer} has unclaimed this ticket!`,

          color:
            '#f39c12',
        },
      );


    if (
      claimMessage
    ) {
      await claimMessage.edit(
        {
          embeds: [
            unclaimEmbed,
          ],

          components:
            [],
        },
      );

    } else {
      await channel.send(
        {
          embeds: [
            unclaimEmbed,
          ],
        },
      );
    }


    await logTicketEvent(
      {
        client:
          channel.client,

        guildId:
          channel.guild.id,

        event: {
          type:
            'unclaim',

          ticketId:
            channel.id,

          ticketNumber:
            ticketData.id,

          userId:
            ticketData.userId,

          executorId:
            unclaimer.id,

          metadata: {
            previousClaimer,
          },
        },
      },
    );


    return ticketData;

  } catch (error) {
    rethrowTicketError(
      error,

      'unclaimTicket',

      'Failed to unclaim ticket. Please try again in a moment.',

      {
        guildId:
          channel?.guild?.id,

        channelId:
          channel?.id,

        unclaimerId:
          unclaimer?.id,
      },
    );
  }
}


/**
 * =========================================================
 * NEXT TICKET NUMBER
 * =========================================================
 */

async function getNextTicketNumber(
  guildId,
) {
  return await incrementTicketCounter(
    guildId,
  );
}


