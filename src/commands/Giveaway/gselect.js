import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway } from '../../utils/giveaways.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('gselect')
        .setDescription('Privately select a giveaway winner for later announcement.')
        .addStringOption(option =>
            option.setName('messageid')
                .setDescription('The giveaway message ID.')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('winner')
                .setDescription('Choose a participant as the winner.')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            throw new TitanBotError('Giveaway command used outside guild', ErrorTypes.VALIDATION,
                'Lệnh này chỉ dùng được trong máy chủ.', { userId: interaction.user.id });
        }
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            throw new TitanBotError('User lacks ManageGuild permission', ErrorTypes.PERMISSION,
                'Bạn cần quyền Quản lý máy chủ để chọn người thắng.', { userId: interaction.user.id });
        }

        const messageId = interaction.options.getString('messageid', true).trim();
        const winner = interaction.options.getUser('winner', true);
        const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
        const giveaway = giveaways.find(item => item.messageId === messageId);

        if (!giveaway) {
            throw new TitanBotError('Giveaway not found', ErrorTypes.VALIDATION,
                'Không tìm thấy giveaway theo Message ID này.', { messageId });
        }
        if (giveaway.ended || giveaway.isEnded) {
            throw new TitanBotError('Giveaway already ended', ErrorTypes.VALIDATION,
                'Giveaway đã kết thúc. Hãy chọn người trước khi kết thúc.', { messageId });
        }
        if (!(giveaway.participants || []).includes(winner.id)) {
            throw new TitanBotError('Selected user is not a participant', ErrorTypes.VALIDATION,
                'Người được chọn chưa tham gia giveaway này nên không thể chọn.', { messageId, winnerId: winner.id });
        }
        if ((giveaway.winnerCount || 1) !== 1) {
            throw new TitanBotError('Manual selection supports one winner', ErrorTypes.VALIDATION,
                'Lệnh này hiện hỗ trợ giveaway có đúng 1 người thắng. Giveaway nhiều người thắng vẫn dùng cách chọn hiện tại.', { messageId });
        }

        giveaway.pendingWinnerIds = [winner.id];
        giveaway.pendingWinnerSelectedBy = interaction.user.id;
        giveaway.pendingWinnerSelectedAt = new Date().toISOString();
        await saveGiveaway(interaction.client, interaction.guildId, giveaway);

        return InteractionHelper.safeReply(interaction, {
            embeds: [successEmbed('Đã lưu lựa chọn riêng tư', 
                `Người được chọn: <@${winner.id}>\nGiải thưởng: **${giveaway.prize || 'phần thưởng'}**\n\nChưa có thông báo công khai. Dùng `/gannounce messageid:${messageId}` sau khi kiểm tra để công bố.`)],
            flags: MessageFlags.Ephemeral
        });
    }
};
