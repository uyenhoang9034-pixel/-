import { EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { deleteBirthday } from '../../../services/birthdayService.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

        const targetUser = interaction.options.getUser("user") || interaction.user;
        const userId = targetUser.id;
        const guildId = interaction.guildId;

        if (targetUser.id !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            const embed = new EmbedBuilder()
                .setColor(0xFCEEC9)
                .setDescription('Bạn cần quyền **Manage Server** để xóa sinh nhật của người khác.');
            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        const result = await deleteBirthday(client, guildId, userId);

        if (result.status === 'not_found') {
            const embed = new EmbedBuilder()
                .setColor(0xFCEEC9)
                .setDescription(`Không tìm thấy ngày sinh đã lưu của **${userId}**.`);
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0xFCEEC9)
            .setDescription(`Đã xóa ngày sinh của **${userId}** khỏi hệ thống.`);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });
    }
};