import { MessageFlags } from 'discord.js';
import { SETNICK_EMOJIS, sendSetnickLog } from '../../../services/setnickService.js';
import { logger } from '../../../utils/logger.js';

export default {
    name: 'setnick_reset',
    async execute(interaction, client) {
        if (!interaction.guild) return;

        // Phản hồi chờ ngay lập tức để tránh lỗi timeout 3 giây của Discord
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const member = interaction.member;

        // Kiểm tra bot có quyền quản lý thành viên này không
        if (!member.manageable) {
            return interaction.editReply({
                content: `${SETNICK_EMOJIS.notice} Bot không thể khôi phục biệt danh của bạn do vai trò của bạn cao hơn hoặc ngang bằng vai trò của Bot (hoặc bạn là Chủ server).`,
            });
        }

        // Kiểm tra xem hiện tại có đang đặt nickname không
        if (!member.nickname) {
            return interaction.editReply({
                content: `${SETNICK_EMOJIS.heart} Biệt danh của bạn hiện tại đã là tên gốc (**${interaction.user.username}**) rồi nè!`,
            });
        }

        try {
            await member.setNickname(null, 'Tự khôi phục tên gốc qua panel');

            // Báo thành công ngay lập tức cho thành viên
            await interaction.editReply({
                content: `${SETNICK_EMOJIS.heart} Đã khôi phục biệt danh của bạn về tên gốc thành công (**${interaction.user.username}**)!`,
            });

            // Gửi log cập nhật dưới nền (không chặn response của thành viên)
            sendSetnickLog({
                client,
                guild: interaction.guild,
                targetMember: member,
                nickname: `${interaction.user.username} (Tên gốc)`,
            }).catch((err) => {
                logger.error('[SetNickReset] Error sending setnick log:', err);
            });
        } catch (error) {
            logger.error('[SetNickReset] Error resetting nickname:', error);
            return interaction.editReply({
                content: `${SETNICK_EMOJIS.notice} Có lỗi xảy ra khi khôi phục biệt danh của bạn. Vui lòng thử lại sau!`,
            });
        }
    },
};

