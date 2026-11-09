import { MessageFlags } from 'discord.js';
import { successEmbed, warningEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { TitanBotError, ErrorTypes, handleInteractionError, replyUserError } from '../utils/errorHandler.js';
import { 
    getGuildGiveaways, 
    saveGiveaway, 
    isGiveawayEnded,
    getEffectiveExcludedWinners
} from '../utils/giveaways.js';
import {
    buildGiveawayPermissionDeniedMessage,
    ensureGiveawayAdminAccess,
    isInGuildInteraction,
} from '../utils/giveawayPermissions.js';
import {
    GIVEAWAY_COOLDOWN_COUNT,
    GIVEAWAY_COOLDOWN_REJECT_MESSAGE,
    checkUserGiveawayCooldown,
} from '../utils/giveawayCooldown.js';
import { Mutex } from '../utils/mutex.js';
import { 
    selectWinners,
    isUserRateLimited,
    recordUserInteraction,
    createGiveawayEmbed,
    createGiveawayButtons,
    createGiveawayContainer,
} from '../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';

export const giveawayJoinHandler = {
    customId: 'giveaway_join',
    async execute(interaction, client) {
        try {
            
            if (isUserRateLimited(interaction.user.id, interaction.message.id)) {
                return replyUserError(interaction, { type: ErrorTypes.RATE_LIMIT, message: 'Please wait a moment before interacting with this giveaway again.' });
            }

            await recordUserInteraction(interaction.user.id, interaction.message.id);

            const lockKey = `giveaway:${interaction.message.id}`;
            await Mutex.runExclusive(lockKey, async () => {
                const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
                const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

                if (!giveaway) {
                    throw new TitanBotError(
                        'Giveaway not found in database',
                        ErrorTypes.VALIDATION,
                        'This giveaway is no longer active.',
                        { messageId: interaction.message.id, guildId: interaction.guildId }
                    );
                }

                const endedByTime = isGiveawayEnded(giveaway);
                const endedByFlag = giveaway.ended || giveaway.isEnded;

                if (endedByTime || endedByFlag) {
                    return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'This giveaway has already ended.' });
                }

                const participants = giveaway.participants || [];
                const userId = interaction.user.id;

                const disqualified = Array.isArray(giveaway.disqualified) ? giveaway.disqualified : [];
                if (disqualified.includes(userId)) {
                    return replyUserError(interaction, {
                        type: ErrorTypes.PERMISSION,
                        message: '❌ Bạn đã bị loại khỏi giveaway này và không thể tham gia lại.',
                    });
                }

                if (participants.includes(userId)) {
                    return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'You have already entered this giveaway! 🎉' });
                }

                const cooldownStatus = await checkUserGiveawayCooldown(
                    client,
                    interaction.guildId,
                    giveaway,
                    userId,
                    { giveaways: guildGiveaways },
                );

                if (cooldownStatus.blocked) {
                    const wonPrize = cooldownStatus.winningGiveaway?.prize || 'giveaway trước đó';
                    const pos = cooldownStatus.positionInCooldown || 1;
                    const gap = cooldownStatus.cooldownGap || GIVEAWAY_COOLDOWN_COUNT;
                    const waitNote = pos >= gap
                        ? `Đây là giveaway thứ **${pos}/${gap}** cần đợi — **giveaway tiếp theo** là bạn có thể tham gia lại rồi nè!`
                        : `Đây là giveaway thứ **${pos}/${gap}** cần đợi — hãy đợi đủ ${gap} giveaway sau khi trúng rồi tham gia lại nhé!`;

                    return await interaction.reply({
                        embeds: [
                            warningEmbed(
                                '🎉 Chưa thể tham gia giveaway này!',
                                `${GIVEAWAY_COOLDOWN_REJECT_MESSAGE}\n\n` +
                                `> • **Giveaway vừa trúng gần nhất:** ${wonPrize}\n` +
                                `> • **Tiến độ lượt chờ:** ${waitNote}`,
                            ),
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                participants.push(userId);
                giveaway.participants = participants;

                await saveGiveaway(client, interaction.guildId, giveaway);

                logger.debug(`User ${interaction.user.tag} joined giveaway ${interaction.message.id}`);

                const isV2 = interaction.message.flags?.has(MessageFlags.IsComponentsV2) || (!interaction.message.embeds?.length && interaction.message.components?.length > 0);
                if (isV2) {
                    const container = createGiveawayContainer(giveaway, 'active');
                    await interaction.message.edit({
                        content: null,
                        embeds: [],
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                    });
                } else {
                    const updatedEmbed = createGiveawayEmbed(giveaway, 'active');
                    const updatedRow = createGiveawayButtons(false);
                    await interaction.message.edit({
                        embeds: [updatedEmbed],
                        components: [updatedRow]
                    });
                }

                await interaction.reply({
                    embeds: [
                        successEmbed(
                            'Success! You have entered the giveaway! 🎉',
                            `Good luck! There are now ${participants.length} entry/entries.`
                        )
                    ],
                    flags: MessageFlags.Ephemeral
                });
            });
        } catch (error) {
            logger.error('Error in giveaway join handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_join',
                handler: 'giveaway'
            });
        }
    }
};

export const giveawayEndHandler = {
    customId: 'giveaway_end',
    async execute(interaction, client) {
        try {
            
            if (!isInGuildInteraction(interaction)) {
                throw new TitanBotError(
                    'Button used outside guild',
                    ErrorTypes.VALIDATION,
                    'This button can only be used in a server.',
                    { userId: interaction.user.id }
                );
            }

            if (!(await ensureGiveawayAdminAccess(interaction))) {
                return replyUserError(interaction, {
                    type: ErrorTypes.PERMISSION,
                    message: buildGiveawayPermissionDeniedMessage('kết thúc giveaway'),
                });
            }

            const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
            const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

            if (!giveaway) {
                throw new TitanBotError(
                    'Giveaway not found in database',
                    ErrorTypes.VALIDATION,
                    'This giveaway is no longer active.',
                    { messageId: interaction.message.id, guildId: interaction.guildId }
                );
            }

            if (giveaway.ended || giveaway.isEnded) {
                throw new TitanBotError(
                    'Giveaway already ended',
                    ErrorTypes.VALIDATION,
                    'This giveaway has already ended.',
                    { messageId: interaction.message.id }
                );
            }

            const participants = giveaway.participants || [];
            const announcementPending = giveaway.delayAnnouncement === true;
            const excludedUserIds = await getEffectiveExcludedWinners(client, interaction.guildId, giveaway);
            const winners = announcementPending ? [] : selectWinners(participants, giveaway.winnerCount || 1, excludedUserIds);

            giveaway.ended = true;
            giveaway.isEnded = true;
            giveaway.winnerIds = winners;
            giveaway.announcementPending = announcementPending;
            giveaway.endedAt = new Date().toISOString();
            giveaway.endedBy = interaction.user.id;

            await saveGiveaway(client, interaction.guildId, giveaway);

            logger.info(`Giveaway ended via button by ${interaction.user.tag}: ${interaction.message.id}`);

            const isV2 = interaction.message.flags?.has(MessageFlags.IsComponentsV2) || (!interaction.message.embeds?.length && interaction.message.components?.length > 0);
            if (isV2) {
                const container = createGiveawayContainer(giveaway, announcementPending ? 'pending' : 'ended', winners);
                await interaction.message.edit({
                    content: null,
                    embeds: [],
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                });
            } else {
                const updatedEmbed = createGiveawayEmbed(giveaway, announcementPending ? 'pending' : 'ended', winners);
                const updatedRow = createGiveawayButtons(true);
                await interaction.message.edit({
                    content: null,
                    embeds: [updatedEmbed],
                    components: [updatedRow]
                });
            }

            // Match the scheduled end and /gend behavior: post a public result
            // message when an admin ends the giveaway early via the End button.
            const winnerMentions = winners.length > 0
                ? winners.map(id => `<@${id}>`).join(', ')
                : null;

            const resultMessage = announcementPending ? null : winners.length > 0
                ? await interaction.channel.send({
                    content:
                        `<a:chiikawag7:1541427343216738414> **Chúc mừng ${winnerMentions}!**\n` +
                        `Bạn đã trúng **${giveaway.prize || 'phần thưởng'}**! <a:giftg1:1543150714732412948>\n` +
                        `Vui lòng mở ticket để nhận phần thưởng.`
                })
                : await interaction.channel.send({
                    content: `<a:chiikawag7:1541427343216738414> Giveaway **${giveaway.prize || 'phần thưởng'}** đã kết thúc nhưng không có người tham gia hợp lệ.`
                });

            if (!announcementPending && winners.length > 0 && resultMessage) {
                giveaway.winnerPingMessageId = resultMessage.id;
                await saveGiveaway(client, interaction.guildId, giveaway);
            }

            try {
                await logEvent({
                    client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_WINNER,
                    data: {
                        description: `Giveaway ended with ${winners.length} winner(s)`,
                        channelId: interaction.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '<a:bunnyg8:1541440159990550580> Prize',
                                value: giveaway.prize || 'Mystery Prize!',
                                inline: true
                            },
                            {
                                name: '<a:bunnyg8:1541440159990550580> Winners',
                                value: winners.length > 0 
                                    ? winners.map(id => `<@${id}>`).join(', ')
                                    : 'No valid entries',
                                inline: false
                            },
                            {
                                name: '<a:bunnyg8:1541440159990550580> Total Entries',
                                value: participants.length.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Error logging giveaway end event:', logError);
            }

            await interaction.reply({
                embeds: [
                    successEmbed(
                        `Giveaway Ended ✅`,
                        announcementPending ? 'Giveaway đã kết thúc. Chưa công bố người thắng; dùng /gannounce để công bố sau.' : `Giveaway đã kết thúc và đã chọn ${winners.length} người thắng!`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            logger.error('Error in giveaway end handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_end',
                handler: 'giveaway'
            });
        }
    }
};

export const giveawayRerollHandler = {
    customId: 'giveaway_reroll',
    async execute(interaction, client) {
        try {
            
            if (!isInGuildInteraction(interaction)) {
                throw new TitanBotError(
                    'Button used outside guild',
                    ErrorTypes.VALIDATION,
                    'This button can only be used in a server.',
                    { userId: interaction.user.id }
                );
            }

            if (!(await ensureGiveawayAdminAccess(interaction))) {
                return replyUserError(interaction, {
                    type: ErrorTypes.PERMISSION,
                    message: buildGiveawayPermissionDeniedMessage('quay lại (reroll) giveaway'),
                });
            }

            const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
            const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

            if (!giveaway) {
                throw new TitanBotError(
                    'Giveaway not found in database',
                    ErrorTypes.VALIDATION,
                    'This giveaway is no longer active.',
                    { messageId: interaction.message.id, guildId: interaction.guildId }
                );
            }

            if (!giveaway.ended && !giveaway.isEnded) {
                throw new TitanBotError(
                    'Giveaway still active',
                    ErrorTypes.VALIDATION,
                    'This giveaway has not ended yet. Please end it first.',
                    { messageId: interaction.message.id }
                );
            }

            const participants = giveaway.participants || [];
            
            if (participants.length === 0) {
                throw new TitanBotError(
                    'No participants to reroll',
                    ErrorTypes.VALIDATION,
                    'There are no entries to reroll from.',
                    { messageId: interaction.message.id }
                );
            }

            const excludedUserIds = await getEffectiveExcludedWinners(client, interaction.guildId, giveaway);
            const newWinners = selectWinners(participants, giveaway.winnerCount, excludedUserIds);

            giveaway.winnerIds = newWinners;
            giveaway.rerolledAt = new Date().toISOString();
            giveaway.rerolledBy = interaction.user.id;

            await saveGiveaway(client, interaction.guildId, giveaway);

            logger.info(`Giveaway rerolled via button by ${interaction.user.tag}: ${interaction.message.id}`);

            const isV2 = interaction.message.flags?.has(MessageFlags.IsComponentsV2) || (!interaction.message.embeds?.length && interaction.message.components?.length > 0);
            if (isV2) {
                const container = createGiveawayContainer(giveaway, 'reroll', newWinners);
                await interaction.message.edit({
                    content: null,
                    embeds: [],
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                });
            } else {
                const updatedEmbed = createGiveawayEmbed(giveaway, 'reroll', newWinners);
                const updatedRow = createGiveawayButtons(true);
                await interaction.message.edit({
                    content: null,
                    embeds: [updatedEmbed],
                    components: [updatedRow]
                });
            }
            const winnerMentions = newWinners.length > 0
    ? newWinners.map(id => `<@${id}>`).join(', ')
    : 'Không có người thắng hợp lệ.';

await interaction.channel.send({
    content:
        `<a:chiikawag7:1541427343216738414> **Chúc mừng ${winnerMentions}!**\n` +
        `Bạn đã trúng **${giveaway.prize || 'phần thưởng'}**! <a:giftg1:1543150714732412948>\n` +
        `Vui lòng mở ticket để nhận phần thưởng.`
});

            try {
                await logEvent({
                    client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                    data: {
                        description: `Giveaway rerolled`,
                        channelId: interaction.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '🎁 Prize',
                                value: giveaway.prize || 'Mystery Prize!',
                                inline: true
                            },
                            {
                                name: '🏆 New Winners',
                                value: newWinners.map(id => `<@${id}>`).join(', '),
                                inline: false
                            },
                            {
                                name: '👥 Total Entries',
                                value: participants.length.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Error logging giveaway reroll event:', logError);
            }

            await interaction.reply({
                embeds: [
                    successEmbed(
                        'Giveaway Rerolled ✅',
                        `New winner(s) have been selected!`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            logger.error('Error in giveaway reroll handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_reroll',
                handler: 'giveaway'
            });
        }
    }
};

export const giveawayViewHandler = {
    customId: 'giveaway_view',
    async execute(interaction, client) {
        try {
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Button used outside guild',
                    ErrorTypes.VALIDATION,
                    'This button can only be used in a server.',
                    { userId: interaction.user.id }
                );
            }

            const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
            const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

            if (!giveaway) {
                throw new TitanBotError(
                    'Giveaway not found in database',
                    ErrorTypes.VALIDATION,
                    'This giveaway could not be found.',
                    { messageId: interaction.message.id, guildId: interaction.guildId }
                );
            }

            if (!giveaway.ended && !giveaway.isEnded && !isGiveawayEnded(giveaway)) {
                return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'This giveaway has not ended yet, so winners are not available.' });
            }

            const winnerIds = Array.isArray(giveaway.winnerIds) ? giveaway.winnerIds : [];
            const winnerMentions = winnerIds.length > 0
                ? winnerIds.map(id => `<@${id}>`).join(', ')
                : 'No valid winners were selected for this giveaway.';

            await interaction.reply({
                embeds: [
                    successEmbed(
                        `Winners for ${giveaway.prize || 'this giveaway'} 🎉`,
                        winnerMentions
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            logger.error('Error in giveaway view handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_view',
                handler: 'giveaway'
            });
        }
    }
};
