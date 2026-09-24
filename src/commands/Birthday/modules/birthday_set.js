import { EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { setBirthday, getUserBirthday } from '../../../services/birthdayService.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

        const month = interaction.options.getInteger("month");
        const day = interaction.options.getInteger("day");
        const year = interaction.options.getInteger("year");
        const targetUser = interaction.options.getUser("user") || interaction.user;
        const userId = targetUser.id;
        const guildId = interaction.guildId;

        if (targetUser.id !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            const embed = new EmbedBuilder()
                .setColor(0xFCEEC9)
                .setDescription('Bạn cần quyền **Manage Server** để đặt sinh nhật cho người khác.');
            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        const existingBirthday = await getUserBirthday(client, guildId, userId);
        if (existingBirthday) {
            const existingDate = existingBirthday.year
                ? `${existingBirthday.day}/${existingBirthday.month}/${existingBirthday.year}`
                : `${existingBirthday.day}/${existingBirthday.month}`;

            const embed = new EmbedBuilder()
                .setColor(0xFCEEC9)
                .setDescription(
                    `<a:heartg1:1545307544808071258> **${userId}** đã có ngày sinh **${existingDate}** trong hệ thống.\n` +
                    'Muốn đổi ngày sinh, hãy dùng `/birthday remove` trước rồi mới `/birthday set` lại.'
                );
            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        await setBirthday(client, guildId, userId, month, day, year);

        const embed = new EmbedBuilder()
            .setColor(0xFCEEC9)
            .setDescription(`<a:heartg1:1545307544808071258> Sinh nhật của **${userId}** vào ngày **${day} tháng ${month} năm ${year}** đã được lưu vào hệ thống!`);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });
    }
};