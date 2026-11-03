import { MessageFlags } from 'discord.js';
import { SETNICK_EMOJIS, sendSetnickLog } from '../../../services/setnickService.js';
import { logger } from '../../../utils/logger.js';

export default {
    name: 'setnick_reset',
    async execute(interaction, client) {
        if (!interaction.guild) return;

        const member = interaction.member;

        // Kiểm tra bot có quyền quản lý thành viên này không
        if (!member.manageable) {
            return interaction.reply({
                content: `${SETNICK_EMOJIS.notice} Bot không thể khôi phục biệt danh của bạn do vai trò của bạn cao hơn hoặc ngang bằng vai trò của Bot (hoặc bạn là Chủ server).`,
                flags: MessageFlags.Ephemeral,
            });
        }

        // Kiểm tra xem hiện tại có đang đặt nickname không
        if (!member.nickname) {
            return interaction.reply({
                content: `${SETNICK_EMOJIS.heart} Biệt danh của bạn hiện tại đã là tên gốc (**${interaction.user.username}**) rồi nè!`,
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            await member.setNickname(null, 'Tự khôi phục tên gốc qua panel');

            // Gửi log cập nhật
            await sendSetnickLog({
                client,
                guild: interaction.guild,
                targetMember: member,
                nickname: `${interaction.user.username} (Tên gốc)`,
            });

            return interaction.reply({
                content: `${SETNICK_EMOJIS.heart} Đã khôi phục biệt danh của bạn về tên gốc thành công (**${interaction.user.username}**)!`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            logger.error('[SetNickReset] Error resetting nickname:', error);
            return interaction.reply({
                content: `${SETNICK_EMOJIS.notice} Có lỗi xảy ra khi khôi phục biệt danh của bạn. Vui lòng thử lại sau!`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
