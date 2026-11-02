import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getColor, botConfig } from '../config/bot.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import { getWelcomeConfig } from '../utils/database.js';
import { formatWelcomeMessage, buildWelcomePayload, buildWelcomeFallbackEmbed } from '../utils/welcome.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { setBirthday as dbSetBirthday } from '../utils/database.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.GuildMemberAdd,
    once: false,

    async execute(member) {
        try {
            const { guild, user } = member;

            const config = await getGuildConfig(member.client, guild.id);

            const welcomeConfig = await getWelcomeConfig(member.client, guild.id);

            const welcomeChannelId = welcomeConfig?.channelId;

            if (welcomeConfig?.enabled && welcomeChannelId) {
                const channel = guild.channels.cache.get(welcomeChannelId);
                const me = guild.members.me;
                const permissions = channel?.isTextBased?.() && me ? channel.permissionsFor(me) : null;
                // Skip only the welcome message if permissions are missing; the rest of the
                // join pipeline (auto-role, logging, counters) must still run.
                if (permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
                    try {
                        const payload = buildWelcomePayload({ member, user, guild, welcomeConfig });
                        await channel.send(payload);
                    } catch (v2Error) {
                        logger.warn('[Welcome] Failed to send V2 welcome container, falling back to embed:', v2Error);
                        try {
                            const fallbackPayload = buildWelcomeFallbackEmbed({ member, user, guild, welcomeConfig });
                            await channel.send(fallbackPayload);
                        } catch (fallbackError) {
                            logger.error('[Welcome] Failed to send fallback welcome embed:', fallbackError);
                        }
                    }
                }
            }

            if (welcomeConfig?.roleIds && welcomeConfig.roleIds.length > 0) {
                const delay = welcomeConfig.autoRoleDelay || 0;
                const singleRoleId = welcomeConfig.roleIds[0];

                if (delay > 0) {
                    const timeout = setTimeout(async () => {
                        const role = guild.roles.cache.get(singleRoleId);
                        if (role) {
                            await assignRoleSafely(member, role);
                        }
                    }, delay * 1000);
                    if (typeof timeout.unref === 'function') {
                        timeout.unref();
                    }
                } else {
                    const role = guild.roles.cache.get(singleRoleId);
                    if (role) {
                        await assignRoleSafely(member, role);
                    }
                }
            }


            try {
                await logEvent({
                    client: member.client,
                    guildId: guild.id,
                    eventType: EVENT_TYPES.MEMBER_JOIN,
                    data: {
                        title: 'User joined',
                        lines: [
                            `**User:** ${user.toString()} (${user.displayName !== user.username ? `@${user.displayName}` : user.tag})`,
                            `**ID:** \`${user.id}\``,
                            `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
                            `**Members:** ${guild.memberCount}`,
                        ],
                        quoted: false,
                        thumbnail: user.displayAvatarURL({ dynamic: true }),
                        userId: user.id,
                    }
                });
            } catch (error) {
                logger.debug('Error logging member join:', error);
            }

            try {
                const backupKey = `guild:${guild.id}:birthdays:left`;
                const backup = (await member.client.db.get(backupKey)) || {};
                if (backup[user.id]) {
                    const { month, day } = backup[user.id];
                    await dbSetBirthday(member.client, guild.id, user.id, month, day);
                    delete backup[user.id];
                    await member.client.db.set(backupKey, backup);
                    logger.debug(`Birthday restored for user ${user.id} in guild ${guild.id}`);
                }
            } catch (error) {
                logger.debug('Error restoring birthday on member join:', error);
            }

        } catch (error) {
            logger.error('Error in guildMemberAdd event:', error);
        }
    }
};

async function assignRoleSafely(member, role) {
    try {
        await member.roles.add(role);
    } catch (error) {
        logger.warn(`Failed to assign role ${role.id} to member ${member.id}:`, error);
    }
}