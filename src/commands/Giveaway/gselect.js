import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway } from '../../utils/giveaways.js';
import { assertGiveawayCommandAdmin } from '../../utils/giveawayPermissions.js';
import { checkUserGiveawayCooldown } from '../../utils/giveawayCooldown.js';
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
        .setDMPermission(false),

    async execute(interaction) {
        await assertGiveawayCommandAdmin(interaction, 'chọn người thắng giveaway');

        const messageId = interaction.options.getString('messageid', true).trim();
        const winner = interaction.options.getUser('winner', true);
        const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
        const giveaway = giveaways.find(item => item.messageId === messageId);

        if (!giveaway) {
            throw new TitanBotError('Giveaway not found', ErrorTypes.VALIDATION,
                'Không tìm thấy giveaway theo Message ID này.', { messageId });
        }
        if ((giveaway.ended || giveaway.isEnded) && !giveaway.announcementPending) {
            throw new TitanBotError('Giveaway already ended', ErrorTypes.VALIDATION,
                'Giveaway đã kết thúc và kết quả đã được công bố; không thể đổi người thắng.', { messageId });
        }
        if (!(giveaway.participants || []).includes(winner.id)) {
            throw new TitanBotError('Selected user is not a participant', ErrorTypes.VALIDATION,
                'Người được chọn chưa tham gia giveaway này nên không thể chọn.', { messageId, winnerId: winner.id });
        }
        if ((giveaway.winnerCount || 1) !== 1) {
            throw new TitanBotError('Manual selection supports one winner', ErrorTypes.VALIDATION,
                'Lệnh này hiện hỗ trợ giveaway có đúng 1 người thắng. Giveaway nhiều người thắng vẫn dùng cách chọn hiện tại.', { messageId });
        }

        const cooldownStatus = await checkUserGiveawayCooldown(
            interaction.client,
            interaction.guildId,
            giveaway,
            winner.id,
            { giveaways },
        );

        giveaway.pendingWinnerIds = [winner.id];
        giveaway.pendingWinnerSelectedBy = interaction.user.id;
        giveaway.pendingWinnerSelectedAt = new Date().toISOString();
        await saveGiveaway(interaction.client, interaction.guildId, giveaway);

        const warningLine = cooldownStatus.blocked
            ? `\n\n⚠️ **Lưu ý Admin:** <@${winner.id}> vừa trúng giveaway **${cooldownStatus.winningGiveaway?.prize || 'gần đây'}** và đang trong thời gian chờ cách 2 GA (${cooldownStatus.positionInCooldown}/${cooldownStatus.cooldownGap}). Em Usagi vẫn lưu lựa chọn theo chỉ định của Admin ạ.`
            : '';

        return InteractionHelper.safeReply(interaction, {
            embeds: [successEmbed('Đã lưu lựa chọn riêng tư', 
                `Người được chọn: <@${winner.id}>\nGiải thưởng: **${giveaway.prize || 'phần thưởng'}**\n\nChưa có thông báo công khai. Dùng lệnh /gannounce với cùng Message ID sau khi kiểm tra để công bố.${warningLine}`)],
            flags: MessageFlags.Ephemeral
        });
    }
};
