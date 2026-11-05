import { MessageFlags } from 'discord.js';
import {
    SETNICK_CONFIG,
    SETNICK_EMOJIS,
    buildNickname,
    sendSetnickLog,
    checkSetnickCooldown,
    recordSetnickCooldown,
} from '../../../services/setnickService.js';
import { logger } from '../../../utils/logger.js';

export default {
    name: 'setnick_modal_submit',
    async execute(interaction, client) {
        if (!interaction.guild) return;

        const member = interaction.member;

        if (!member.manageable) {
            return interaction.reply({
                content: `${SETNICK_EMOJIS.notice} Bot không thể thay đổi biệt danh của bạn do vai trò của bạn cao hơn hoặc ngang bằng vai trò của Bot (hoặc bạn là Chủ server).`,
                flags: MessageFlags.Ephemeral,
            });
        }

        // Kiểm tra giới hạn đổi biệt danh (1 lần / 2 ngày)
        const cooldownInfo = await checkSetnickCooldown(
            client,
            interaction.guild.id,
            interaction.user.id,
            member,
        );
        if (cooldownInfo.isOnCooldown) {
            return interaction.reply({
                content: cooldownInfo.message,
                flags: MessageFlags.Ephemeral,
            });
        }

        const rawName = interaction.fields.getTextInputValue('nickname_input')?.trim();

        if (!rawName || rawName.length < 1 || rawName.length > SETNICK_CONFIG.maxInputLength) {
            return interaction.reply({
                content: `${SETNICK_EMOJIS.notice} Tên không hợp lệ! Vui lòng nhập từ 1 đến ${SETNICK_CONFIG.maxInputLength} ký tự.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const newNickname = buildNickname(rawName);

        if (newNickname.length > SETNICK_CONFIG.maxTotalLength) {
            return interaction.reply({
                content: `${SETNICK_EMOJIS.notice} Biệt danh sau khi định dạng vượt quá giới hạn 32 ký tự của Discord! Vui lòng chọn tên ngắn hơn.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (member.nickname === newNickname) {
            return interaction.reply({
                content: `${SETNICK_EMOJIS.heart} Biệt danh của bạn đã là **${newNickname}** rồi nè!`,
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            await member.setNickname(newNickname, 'Tự đổi nickname qua panel');

            // Ghi nhận cooldown 1 lần / 2 ngày
            await recordSetnickCooldown(client, interaction.guild.id, interaction.user.id);

            // Gửi log về kênh log
            await sendSetnickLog({
                client,
                guild: interaction.guild,
                targetMember: member,
                nickname: newNickname,
            });

            return interaction.reply({
                content: `${SETNICK_EMOJIS.heart} Đã thay đổi biệt danh của bạn thành **${newNickname}** thành công!`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            logger.error('[SetNickModalSubmit] Error changing nickname:', error);
            return interaction.reply({
                content: `${SETNICK_EMOJIS.notice} Có lỗi xảy ra khi đổi biệt danh của bạn. Vui lòng thử lại sau!`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

