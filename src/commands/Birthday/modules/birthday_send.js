import { EmbedBuilder, MessageFlags, PermissionsBitField } from 'discord.js';
import { getGuildConfig } from '../../../services/config/guildConfig.js';
import { getGuildBirthdays } from '../../../utils/database.js';
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

function buildBirthdayEmbed(member, birthday) {
    const footerTime = new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh'
    });

    return new EmbedBuilder()
        .setColor(0xFCEEC9)
        .setDescription(
            `## <a:trangtrig2:1546040703375904801> 𝓗𝓪𝓹𝓹𝔂 𝓑𝓲𝓻𝓽𝓱𝓭𝓪𝔂! <a:trangtrig3:1546040818261954610>\n\n` +
            `<a:giftg1:1543150714732412948> Chúc mừng sinh nhật ${member.toString()}!\n` +
            `<a:giftg1:1543150714732412948> **生日快乐** ${member.toString()}!\n` +
            `<a:giftg1:1543150714732412948> **お誕生日おめでとう** ${member.toString()}!\n` +
            `<a:giftg1:1543150714732412948> **생일 축하해** ${member.toString()}!\n\n` +
            `*Ngày ${birthday.day} tháng ${birthday.month}${birthday.year ? ` - ${new Date().getFullYear() - birthday.year} tuổi` : ''}*\n\n` +
            'Chúc bạn có một ngày sinh nhật thật vui vẻ và tuyệt vời! Tuổi mới lúc nào cũng mạnh khỏe, vui vẻ và thành công trong mọi lĩnh vực nhé!'
        )
        .setImage('https://raw.githubusercontent.com/uyenhoang9034-pixel/-/main/assets/birthday/birthday.jpg')
        .setFooter({ text: `Birthday Bot • ${footerTime}` });
}

export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            const embed = new EmbedBuilder()
                .setColor(0xFCEEC9)
                .setDescription('Bạn cần quyền **Manage Server** để gửi thông báo sinh nhật thủ công.');
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
                    content: 'Chưa thiết lập kênh thông báo sinh nhật. Hãy dùng `/birthday setchannel` trước.'
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

                await channel.send({
                    embeds: [buildBirthdayEmbed(member, birthdays[userId])]
                });
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
