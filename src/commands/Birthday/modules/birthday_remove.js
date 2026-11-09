import { EmbedBuilder, MessageFlags } from 'discord.js';
import { deleteBirthday } from '../../../services/birthdayService.js';
import { hasRoleTier } from '../../../config/commands/roleAccess.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';

export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

        const targetUser = interaction.options.getUser("user") || interaction.user;
        const userId = targetUser.id;
        const guildId = interaction.guildId;

        if (!hasRoleTier(interaction.member, 'MID_ADMIN', interaction.guild, interaction.user)) {
            const embed = new EmbedBuilder()
                .setColor(0xFCEEC9)
                .setDescription('Bạn không có quyền sử dụng lệnh này.');
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