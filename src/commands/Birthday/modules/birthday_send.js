import { EmbedBuilder, MessageFlags } from 'discord.js';
import { getGuildConfig } from '../../../services/config/guildConfig.js';
import { getGuildBirthdays } from '../../../utils/database.js';
import { hasRoleTier } from '../../../config/commands/roleAccess.js';
import {
    getBirthdayImageAttachment,
    BIRTHDAY_FALLBACK_URL,
    buildBirthdayContainer,
    buildBirthdayEmbed,
} from '../../../services/birthdayService.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

function getVietnamToday() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        month: 'numeric',
        day: 'numeric'
    }).formatToParts(new Date());

    return {
        month: Number(parts.find(part => part.type === 'month')?.value),
        day: Number(parts.find(part => part.type === 'day')?.value)
    };
}

export default {
    async execute(interaction, config, client) {
        if (!hasRoleTier(interaction.member, 'MID_ADMIN', interaction.guild, interaction.user)) {
            const embed = new EmbedBuilder()
                .setColor(0xFCEEC9)
                .setDescription('Bạn không có quyền gửi thông báo sinh nhật thủ công.');
            return InteractionHelper.safeReply(interaction, {
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        }

        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

        try {
            const guildConfig = await getGuildConfig(client, interaction.guildId);
            const birthdayChannelId = guildConfig.birthdayChannelId;

            if (!birthdayChannelId) {
                return InteractionHelper.safeEditReply(interaction, {
                    content: 'Chưa thiết lập kênh thông báo sinh nhật. Hãy dùng `/birthday-admin setchannel` trước.'
                });
            }

            const channel = await interaction.guild.channels.fetch(birthdayChannelId).catch(() => null);
            if (!channel?.isTextBased()) {
                return InteractionHelper.safeEditReply(interaction, {
                    content: 'Không tìm thấy kênh thông báo sinh nhật đã thiết lập.'
                });
            }

            const birthdays = (await getGuildBirthdays(client, interaction.guildId)) || {};
            const targetUser = interaction.options.getUser('user');
            const today = getVietnamToday();

            let userIds = Object.entries(birthdays)
                .filter(([, data]) => data.month === today.month && data.day === today.day)
                .map(([userId]) => userId);

            if (targetUser) {
                const birthday = birthdays[targetUser.id];
                if (!birthday) {
                    return InteractionHelper.safeEditReply(interaction, {
                        content: `Không tìm thấy ngày sinh đã lưu của **${targetUser.id}**.`
                    });
                }

                if (birthday.month !== today.month || birthday.day !== today.day) {
                    return InteractionHelper.safeEditReply(interaction, {
                        content: `Hôm nay không phải ngày sinh đã lưu của **${targetUser.id}**.`
                    });
                }

                userIds = [targetUser.id];
            }

            if (userIds.length === 0) {
                return InteractionHelper.safeEditReply(interaction, {
                    content: 'Hôm nay không có sinh nhật nào đã được lưu trong hệ thống.'
                });
            }

            let sent = 0;
            for (const userId of userIds) {
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                if (!member) continue;

                const attachment = getBirthdayImageAttachment();
                const files = attachment ? [attachment] : [];
                const container = buildBirthdayContainer(member, birthdays[userId]);

                try {
                    await channel.send({
                        content: null,
                        embeds: [],
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                        files
                    });
                } catch (v2Error) {
                    logger.warn('Failed sending manual birthday announcement with V2 container, falling back to Embed:', v2Error);
                    const embed = buildBirthdayEmbed(member, birthdays[userId], Boolean(attachment));

                    try {
                        await channel.send({
                            embeds: [embed],
                            files
                        });
                    } catch (sendError) {
                        if (files.length > 0) {
                            logger.warn('Failed sending manual birthday announcement with files, retrying without files:', sendError);
                            embed.setImage(BIRTHDAY_FALLBACK_URL);
                            await channel.send({
                                embeds: [embed]
                            });
                        } else {
                            throw sendError;
                        }
                    }
                }
                sent++;
            }

            return InteractionHelper.safeEditReply(interaction, {
                content: sent > 0
                    ? `Đã gửi **${sent}** thông báo sinh nhật vào ${channel}.`
                    : 'Không tìm thấy thành viên hợp lệ để gửi thông báo sinh nhật.'
            });
        } catch (error) {
            logger.error('birthday_send error:', error);
            return InteractionHelper.safeEditReply(interaction, {
                content: 'Không thể gửi thông báo sinh nhật thủ công. Vui lòng thử lại.'
            });
        }
    }
};
