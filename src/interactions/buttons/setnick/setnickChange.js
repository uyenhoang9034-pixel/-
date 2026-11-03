import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} from 'discord.js';
import { SETNICK_CONFIG, SETNICK_EMOJIS } from '../../../services/setnickService.js';

export default {
    name: 'setnick_change',
    async execute(interaction, client) {
        if (!interaction.guild) return;

        // Kiểm tra xem bot có thể chỉnh sửa nickname của thành viên này không
        if (!interaction.member.manageable) {
            return interaction.reply({
                content: `${SETNICK_EMOJIS.notice} Bot không thể thay đổi biệt danh của bạn do vai trò của bạn cao hơn hoặc ngang bằng vai trò của Bot (hoặc bạn là Chủ server).`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('setnick_modal_submit')
            .setTitle('Tự Đổi Nickname');

        const input = new TextInputBuilder()
            .setCustomId('nickname_input')
            .setLabel('Tên bạn muốn đổi (1 - 20 ký tự)')
            .setPlaceholder('Nhập tên của bạn (bot tự thêm ⋆˚࿔  và  ♡)...')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(SETNICK_CONFIG.maxInputLength)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(input);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    },
};

