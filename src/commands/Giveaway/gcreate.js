import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { logger } from '../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../utils/errorHandler.js';
import { getColor, botConfig } from '../config/bot.js';
import { getEndedGiveaways, markGiveawayEnded, getGiveawayByMessageId, updateGiveawayData } from '../utils/database.js';
import { checkRateLimit, getRateLimitStatus } from '../utils/rateLimiter.js';
import { logEvent, EVENT_TYPES } from './loggingService.js';

const GIVEAWAY_CONFIG = botConfig.giveaways || {};
const GIVEAWAY_INTERACTION_COOLDOWN = 1000;

function getGiveawayInteractionKey(userId, giveawayId) {
    return `giveaway:${userId}:${giveawayId}`;
}

export function parseDuration(durationString) {
    if (!durationString || typeof durationString !== 'string') {
        throw new TitanBotError(
            'Invalid duration format provided',
            ErrorTypes.VALIDATION,
            'Please provide a valid duration (e.g., 1h, 30m, 5d, 10s).',
            { durationString }
        );
    }

    const regex = /^(\d+)([hmds])$/i;
    const match = durationString.trim().match(regex);

    if (!match) {
        throw new TitanBotError(
            `Invalid duration format: ${durationString}`,
            ErrorTypes.VALIDATION,
            'Invalid duration format. Use: 1h, 30m, 5d, 10s (min: 10s, max: 30d)',
            { input: durationString }
        );
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (amount <= 0 || amount > 999) {
        throw new TitanBotError(
            `Duration amount out of range: ${amount}`,
            ErrorTypes.VALIDATION,
            'Duration amount must be between 1 and 999.',
            { amount, unit }
        );
    }

    let ms = 0;
    switch (unit) {
        case 's':
            ms = amount * 1000;
            break;
        case 'm':
            ms = amount * 60 * 1000;
            break;
        case 'h':
            ms = amount * 60 * 60 * 1000;
            break;
        case 'd':
            ms = amount * 24 * 60 * 60 * 1000;
            break;
        default:
            throw new TitanBotError(
                `Unknown duration unit: ${unit}`,
                ErrorTypes.VALIDATION,
                'Please use s (seconds), m (minutes), h (hours), or d (days).',
                { unit }
            );
    }

    const maxDuration = GIVEAWAY_CONFIG.maximumDuration ?? 30 * 24 * 60 * 60 * 1000;
    if (ms > maxDuration) {
        throw new TitanBotError(
            `Duration exceeds maximum: ${ms}ms > ${maxDuration}ms`,
            ErrorTypes.VALIDATION,
            `Maximum duration is ${Math.floor(maxDuration / (24 * 60 * 60 * 1000))} days.`,
            { requestedMs: ms, maxMs: maxDuration }
        );
    }

    const minDuration = GIVEAWAY_CONFIG.minimumDuration ?? 10 * 1000;
    if (ms < minDuration) {
        throw new TitanBotError(
            `Duration below minimum: ${ms}ms < ${minDuration}ms`,
            ErrorTypes.VALIDATION,
            `Minimum duration is ${Math.ceil(minDuration / 1000)} seconds.`,
            { requestedMs: ms, minMs: minDuration }
        );
    }

    return ms;
}

export function validatePrize(prize) {
    if (!prize || typeof prize !== 'string') {
        throw new TitanBotError(
            'Prize must be a non-empty string',
            ErrorTypes.VALIDATION,
            'Please provide a valid prize description.',
            { prize }
        );
    }

    const trimmed = prize.trim();
    if (trimmed.length === 0 || trimmed.length > 256) {
        throw new TitanBotError(
            `Prize length out of range: ${trimmed.length}`,
            ErrorTypes.VALIDATION,
            'Prize must be between 1 and 256 characters.',
            { length: trimmed.length }
        );
    }

    return trimmed;
}

export function validateWinnerCount(winnerCount) {
    const minimumWinners = GIVEAWAY_CONFIG.minimumWinners ?? 1;
    const maximumWinners = GIVEAWAY_CONFIG.maximumWinners ?? 10;

    if (!Number.isInteger(winnerCount) || winnerCount < minimumWinners || winnerCount > maximumWinners) {
        throw new TitanBotError(
            `Invalid winner count: ${winnerCount}`,
            ErrorTypes.VALIDATION,
            `Winner count must be between ${minimumWinners} and ${maximumWinners}.`,
            { winnerCount, minimumWinners, maximumWinners }
        );
    }
}

export function createGiveawayEmbed(giveaway, status, winners = []) {
    try {
        const isEnded = status === 'ended' || status === 'reroll';
        
        let color = giveaway.color 
            ? (typeof giveaway.color === 'string' ? parseInt(giveaway.color.replace('#', ''), 16) : giveaway.color)
            : (isEnded ? getColor('giveaway.ended') : 0xE91E63);

        const emoji = giveaway.emoji || '🎁';
        const endTime = giveaway.endsAt || giveaway.endTime;
        const winnerDisplay = winners.length > 0 
            ? winners.map(id => `<@${id}>`).join(', ')
            : 'No valid entries';

        // 1. Custom or Default Title
        const embedTitle = giveaway.title || giveaway.prize;

        // 2. Custom or Default Description
        let description = '';
        if (giveaway.description) {
            description = giveaway.description
                .replace(/{emoji}/g, emoji)
                .replace(/{prize}/g, giveaway.prize || '')
                .replace(/{host}/g, `<@${giveaway.hostId}>`)
                .replace(/{endsAt}/g, `<t:${Math.floor(endTime / 1000)}:R>`)
                .replace(/{winners}/g, winnerDisplay);
        } else {
            description = `${emoji} Click the button below to enter!\n\n`;
            if (isEnded) {
                description += `✨ • **Winners:** ${winnerDisplay}\n`;
            } else {
                description += `✨ • **Ends:** <t:${Math.floor(endTime / 1000)}:R>\n`;
            }
            description += `✨ • **Hosted by:** <@${giveaway.hostId}>`;
        }

        // 3. Custom or Default Footer
        const footerText = giveaway.footerText 
            ? giveaway.footerText
                .replace(/{winnerCount}/g, (giveaway.winnerCount || 1).toString())
                .replace(/{entries}/g, (giveaway.participants?.length || 0).toString())
            : `${giveaway.winnerCount || 1} winner(s) • Entries: ${giveaway.participants?.length || 0}`;

        const embed = new EmbedBuilder()
            .setTitle(embedTitle)
            .setDescription(description)
            .setColor(color)
            .setFooter({
                text: footerText,
                iconURL: giveaway.footerIcon || null
            });

        // 4. Custom / Toggleable Timestamp
        if (giveaway.showTimestamp !== false) {
            const customTimestamp = giveaway.customTimestamp ? new Date(giveaway.customTimestamp) : null;
            const defaultTimestamp = isEnded 
                ? (giveaway.endedAt ? new Date(giveaway.endedAt) : new Date()) 
                : new Date(endTime);
            embed.setTimestamp(customTimestamp || defaultTimestamp);
        }

        if (giveaway.thumbnailUrl) embed.setThumbnail(giveaway.thumbnailUrl);
        if (giveaway.bannerUrl) embed.setImage(giveaway.bannerUrl);

        return embed;
    } catch (error) {
        logger.error('Error creating giveaway embed:', error);
        throw new TitanBotError(
            'Failed to create giveaway embed',
            ErrorTypes.UNKNOWN,
            'An internal error occurred while formatting the giveaway.',
            { error: error.message }
        );
    }
}

export function createGiveawayButtons(ended = false, customEmoji = '🎁') {
    try {
        const row = new ActionRowBuilder();

        if (ended) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_reroll')
                    .setLabel('Reroll')
                    .setEmoji('🎲')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId('giveaway_view')
                    .setLabel('View Winners')
                    .setEmoji('👁️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(false)
            );
        } else {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_join')
                    .setLabel('Enter')
                    .setEmoji(customEmoji)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId('giveaway_end')
                    .setLabel('End')
                    .setEmoji('🛑')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(false)
            );
        }

        return row;
    } catch (error) {
        logger.error('Error creating giveaway buttons:', error);
        throw new TitanBotError(
            'Failed to create giveaway buttons',
            ErrorTypes.UNKNOWN,
            'An internal error occurred while creating interactive buttons.',
            { error: error.message }
        );
    }
}

export function selectWinners(participants, winnerCount) {
    if (!Array.isArray(participants) || participants.length === 0) {
        return [];
    }

    const uniqueParticipants = [...new Set(participants)];

    if (!Number.isInteger(winnerCount) || winnerCount < 1) {
        throw new TitanBotError(
            'Invalid winner count for selection',
            ErrorTypes.VALIDATION,
            'Winner count must be at least 1.',
            { winnerCount }
        );
    }

    const requested = Math.min(winnerCount, uniqueParticipants.length);

    try {
        const shuffled = [...uniqueParticipants];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, requested);
    } catch (error) {
        logger.error('Error selecting winners:', error);
        throw new TitanBotError(
            'Failed to select winners',
            ErrorTypes.UNKNOWN,
            'An error occurred while selecting winners.',
            { error: error.message, participantCount: participants.length }
        );
    }
}

export function isUserRateLimited(userId, giveawayId) {
    const status = getRateLimitStatus(
        getGiveawayInteractionKey(userId, giveawayId),
        GIVEAWAY_INTERACTION_COOLDOWN,
    );
    return status.attempts >= 1 && status.remaining > 0;
}

export async function recordUserInteraction(userId, giveawayId) {
    await checkRateLimit(
        getGiveawayInteractionKey(userId, giveawayId),
        1,
        GIVEAWAY_INTERACTION_COOLDOWN,
    );
}

export async function editGiveawayDetails(client, messageId, updates = {}) {
    try {
        const giveawayRecord = await getGiveawayByMessageId(client, messageId);
        if (!giveawayRecord) {
            throw new TitanBotError(
                'Giveaway not found',
                ErrorTypes.NOT_FOUND,
                'Could not find the requested giveaway record.',
                { messageId }
            );
        }

        let giveawayData = typeof giveawayRecord.data === 'string' 
            ? JSON.parse(giveawayRecord.data) 
            : giveawayRecord.data;

        // Apply dynamic updates from Panel / Modals
        if (updates.title !== undefined) giveawayData.title = updates.title;
        if (updates.description !== undefined) giveawayData.description = updates.description;
        if (updates.footerText !== undefined) giveawayData.footerText = updates.footerText;
        if (updates.footerIcon !== undefined) giveawayData.footerIcon = updates.footerIcon;
        if (updates.showTimestamp !== undefined) giveawayData.showTimestamp = updates.showTimestamp;
        if (updates.customTimestamp !== undefined) giveawayData.customTimestamp = updates.customTimestamp;
        if (updates.color !== undefined) giveawayData.color = updates.color;
        if (updates.thumbnailUrl !== undefined) giveawayData.thumbnailUrl = updates.thumbnailUrl;
        if (updates.bannerUrl !== undefined) giveawayData.bannerUrl = updates.bannerUrl;
        if (updates.emoji !== undefined) giveawayData.emoji = updates.emoji;

        // Fetch channel & message to update live Discord Embed
        const guild = client.guilds.cache.get(giveawayRecord.guild_id);
        const channel = await guild?.channels.fetch(giveawayData.channelId).catch(() => null);
        const message = await channel?.messages.fetch(messageId).catch(() => null);

        if (message) {
            const isEnded = giveawayData.ended || giveawayData.isEnded;
            const updatedEmbed = createGiveawayEmbed(
                giveawayData, 
                isEnded ? 'ended' : 'active', 
                giveawayData.winnerIds || []
            );
            await message.edit({
                embeds: [updatedEmbed],
                components: [createGiveawayButtons(isEnded, giveawayData.emoji || '🎁')]
            });
        }

        // Save updated JSON to database
        await updateGiveawayData(client, messageId, giveawayData);
        return giveawayData;
    } catch (error) {
        logger.error('Error updating giveaway details:', error);
        throw error;
    }
}

export async function endGiveaway(client, giveaway, guildId, endedBy) {
    try {
        if (!giveaway) {
            throw new TitanBotError(
                'Giveaway object is null or undefined',
                ErrorTypes.VALIDATION,
                'Cannot end a non-existent giveaway.',
                { giveaway }
            );
        }

        if (giveaway.ended === true || giveaway.isEnded === true) {
            throw new TitanBotError(
                `Giveaway ${giveaway.messageId} is already ended`,
                ErrorTypes.VALIDATION,
                'This giveaway has already ended.',
                { giveawayId: giveaway.messageId, status: 'already_ended' }
            );
        }

        const participants = giveaway.participants || [];
        const winners = selectWinners(participants, giveaway.winnerCount || 1);

        const updatedGiveaway = {
            ...giveaway,
            ended: true,
            isEnded: true,
            winnerIds: winners,
            endedAt: new Date().toISOString(),
            endedBy: endedBy,
            participantCount: participants.length
        };

        logger.info(`Ending giveaway ${giveaway.messageId}: selected ${winners.length} winners from ${participants.length} entries`);

        return {
            giveaway: updatedGiveaway,
            winners: winners,
            participantCount: participants.length
        };
    } catch (error) {
        if (error instanceof TitanBotError) {
            logger.debug(`Giveaway end validation error: ${error.message}`, error.context || {});
            throw error;
        }
        logger.error('Error ending giveaway:', error);
        throw new TitanBotError(
            'Failed to end giveaway',
            ErrorTypes.UNKNOWN,
            'An error occurred while ending the giveaway.',
            { error: error.message, giveawayId: giveaway?.messageId }
        );
    }
}

export async function checkGiveaways(client) {
    try {
        if (!client.db) {
            logger.warn('Database not available for giveaway check');
            return;
        }

        const endedGiveaways = await getEndedGiveaways(client);

        if (endedGiveaways.length === 0) {
            return;
        }

        logger.info(`Processing ${endedGiveaways.length} ended giveaways`);

        for (const giveawayRecord of endedGiveaways) {
            try {
                const { id: giveawayId, guild_id: guildId, message_id: messageId, data: giveawayData } = giveawayRecord;
                const giveaway = typeof giveawayData === 'string' ? JSON.parse(giveawayData) : giveawayData;

                const guild = client.guilds.cache.get(guildId);
                if (!guild) {
                    logger.debug(`Guild ${guildId} not found, skipping giveaway ${messageId}`);
                    continue;
                }

                const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
                if (!channel) {
                    logger.debug(`Channel ${giveaway.channelId} not found for giveaway ${messageId}`);
                    continue;
                }

                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (!message) {
                    logger.debug(`Message ${messageId} not found for giveaway in channel ${giveaway.channelId}`);
                    continue;
                }

                const participants = giveaway.participants || [];
                const winners = selectWinners(participants, giveaway.winnerCount || 1);

                const winnerMentions = winners.length > 0
                    ? winners.map(id => `<@${id}>`).join(', ')
                    : 'No valid entries!';

                const endedEmbed = createGiveawayEmbed(giveaway, 'ended', winners);

                await message.edit({
                    embeds: [endedEmbed],
                    components: [createGiveawayButtons(true, giveaway.emoji || '🎁')]
                });

                giveaway.ended = true;
                giveaway.isEnded = true;
                giveaway.winnerIds = winners;
                giveaway.endedAt = new Date().toISOString();

                const markedSuccess = await markGiveawayEnded(client, giveawayId, giveaway);
                if (!markedSuccess) {
                    logger.warn(`Failed to mark giveaway ${messageId} as ended in database`);
                }

                if (winners.length > 0) {
                    const winnerAnnouncement = `🎉 Congratulations ${winnerMentions}! You won the **${giveaway.prize || 'giveaway'}**! Please contact <@${giveaway.hostId}> to claim your prize.`;
                    const winnerPingMsg = await channel.send({ content: winnerAnnouncement });
                    giveaway.winnerPingMessageId = winnerPingMsg.id;
                    await markGiveawayEnded(client, giveawayId, giveaway);

                    try {
                        await logEvent({
                            client,
                            guildId,
                            eventType: EVENT_TYPES.GIVEAWAY_WINNER,
                            data: {
                                description: `Giveaway ended with ${winners.length} winner(s)`,
                                channelId: channel.id,
                                fields: [
                                    {
                                        name: '🎁 Prize',
                                        value: giveaway.prize || 'Mystery Prize!',
                                        inline: true
                                    },
                                    {
                                        name: '🏆 Winners',
                                        value: winners.map(id => `<@${id}>`).join(', '),
                                        inline: false
                                    },
                                    {
                                        name: '👥 Entries',
                                        value: participants.length.toString(),
                                        inline: true
                                    }
                                ]
                            }
                        });
                    } catch (error) {
                        logger.debug('Error logging giveaway winner:', error);
                    }
                } else {
                    await channel.send({ content: `The giveaway for **${giveaway.prize}** has ended with no valid entries.` });
                }

                logger.info(`Ended giveaway ${messageId} in guild ${guildId}`);
            } catch (error) {
                logger.error(`Error processing giveaway:`, error);
            }
        }
    } catch (error) {
        logger.error('Error checking giveaways:', error);
    }
}
