import { EmbedBuilder } from 'discord.js';
import { getUpcomingBirthdays } from '../../../services/birthdayService.js';
import { deleteBirthday } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const next5 = await getUpcomingBirthdays(client, interaction.guildId, 5);

        if (next5.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFFB6C1)
                .setDescription(
                    '<a:trangtrig2:1546040703375904801> **UPCOMING BIRTHDAYS** <a:trangtrig3:1546040818261954610>\n\n' +
                    '<a:heartg1:1545307544808071258> Chưa có sinh nhật nào được lưu trong hệ thống.'
                );
            return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        let birthdayList =
            '<a:trangtrig2:1546040703375904801> **UPCOMING BIRTHDAYS** <a:trangtrig3:1546040818261954610>\n\n' +
            '<a:heartg1:1545307544808071258> **5 sinh nhật sắp tới**\n\n';

        let displayIndex = 0;
        const staleUserIds = [];

        for (const birthday of next5) {
            const member = await interaction.guild.members.fetch(birthday.userId).catch(() => null);
            if (!member) {
                staleUserIds.push(birthday.userId);
                continue;
            }

            displayIndex++;

            let timeUntil;
            if (birthday.daysUntil === 0) {
                timeUntil = 'Hôm nay';
            } else if (birthday.daysUntil === 1) {
                timeUntil = 'Ngày mai';
            } else {
                timeUntil = `Còn ${birthday.daysUntil} ngày`;
            }

            birthdayList +=
                `**${displayIndex}. ${member.toString()}**\n` +
                `Ngày ${birthday.day} tháng ${birthday.month} · ${timeUntil}\n\n`;
        }

        for (const userId of staleUserIds) {
            deleteBirthday(client, interaction.guildId, userId).catch(() => null);
        }

        if (displayIndex === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFFB6C1)
                .setDescription(
                    '<a:trangtrig2:1546040703375904801> **UPCOMING BIRTHDAYS** <a:trangtrig3:1546040818261954610>\n\n' +
                    '<a:heartg1:1545307544808071258> Không tìm thấy sinh nhật sắp tới của thành viên hiện tại.'
                );
            return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFB6C1)
            .setDescription(birthdayList.trim());

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

        logger.info('Next birthdays retrieved successfully', {
            userId: interaction.user.id,
            guildId: interaction.guildId,
            upcomingCount: displayIndex,
            commandName: 'next_birthdays'
        });
    }
};
