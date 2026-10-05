import { MessageFlags } from 'discord.js';
import { verifyPrivateMember } from '../../../services/privateVerificationService.js';

export default {
    name: 'private_verify_accept',

    async execute(interaction, client) {
        if (!interaction.inGuild()) {
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = await verifyPrivateMember(client, interaction);

        if (!result.ok) {
            let message = '❌ Nút xác nhận này không hợp lệ trong kênh hiện tại.';

            if (result.reason === 'missing_role') {
                message = '❌ Role xác nhận không còn tồn tại. Hãy báo ban quản lý.';
            } else if (result.reason === 'birthday_missing') {
                message =
                    '<:bunny2:1546149280463716413> Không thể xác nhận độ tuổi vì bạn chưa có đầy đủ ngày sinh trong hệ thống Birthday.\n' +
                    'Vui lòng liên hệ ban quản trị để cập nhật ngày sinh trước khi xác nhận.';
            } else if (result.reason === 'underage') {
                message =
                    '<:bunny2:1546149280463716413> Bạn chưa đủ 18 tuổi theo ngày sinh đã lưu trong hệ thống Birthday nên chưa thể mở quyền trò chuyện tại kênh này.';
            }

            return interaction.editReply({ content: message });
        }

        return interaction.editReply({
            content:
                '<a:meongg7:1546091671970783282> **Xác nhận thành công!**\n' +
                'Bạn đã được mở quyền trò chuyện tại <#1556535965219033088>.\n' +
                'Hãy giữ những điều được chia sẻ ở đây trong sự tôn trọng và riêng tư nhé.',
        });
    },
};
