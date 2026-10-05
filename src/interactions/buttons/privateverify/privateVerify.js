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
            const message =
                result.reason === 'missing_role'
                    ? '❌ Role xác nhận không còn tồn tại. Hãy báo ban quản lý.'
                    : '❌ Nút xác nhận này không hợp lệ trong kênh hiện tại.';
            return interaction.editReply({ content: message });
        }

        return interaction.editReply({
            content: result.alreadyVerified
                ? '✅ Bạn đã xác nhận trước đó và có quyền trò chuyện trong kênh này.'
                : '✅ Xác nhận thành công. Bạn đã có thể gửi tin nhắn trong kênh này.',
        });
    },
};
