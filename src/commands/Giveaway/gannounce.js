import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway, getEffectiveExcludedWinners } from '../../utils/giveaways.js';
import { createGiveawayEmbed, createGiveawayButtons, createGiveawayContainer, selectWinners } from '../../services/giveawayService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('gannounce')
        .setDescription('Announce a privately selected giveaway winner.')
        .addStringOption(option =>
            option.setName('messageid')
                .setDescription('The giveaway message ID.')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            throw new TitanBotError('Giveaway command used outside guild', ErrorTypes.VALIDATION,
                'Lệnh này chỉ dùng được trong máy chủ.', { userId: interaction.user.id });
        }
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            throw new TitanBotError('User lacks ManageGuild permission', ErrorTypes.PERMISSION,
                'Bạn cần quyền Quản lý máy chủ để công bố người thắng.', { userId: interaction.user.id });
        }

        const messageId = interaction.options.getString('messageid', true).trim();
        const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
        const giveaway = giveaways.find(item => item.messageId === messageId);

        if (!giveaway) {
            throw new TitanBotError('Giveaway not found', ErrorTypes.VALIDATION,
                'Không tìm thấy giveaway theo Message ID này.', { messageId });
        }
        if ((giveaway.ended || giveaway.isEnded) && !giveaway.announcementPending) {
            throw new TitanBotError('Giveaway already ended', ErrorTypes.VALIDATION,
                'Giveaway đã được công bố kết quả rồi.', { messageId });
        }

        let winners = Array.isArray(giveaway.pendingWinnerIds) ? giveaway.pendingWinnerIds : [];
        if (!winners.length && giveaway.announcementPending) {
            const excludedUserIds = await getEffectiveExcludedWinners(interaction.client, interaction.guildId, giveaway);
            winners = selectWinners(giveaway.participants || [], giveaway.winnerCount || 1, excludedUserIds);
        }
        if (!winners.length) {
            throw new TitanBotError('No winner available', ErrorTypes.VALIDATION,
                'Không có người tham gia hợp lệ để công bố.', { messageId });
        }

        const channel = await interaction.client.channels.fetch(giveaway.channelId).catch(() => null);
        if (!channel?.isTextBased()) {
            throw new TitanBotError('Giveaway channel unavailable', ErrorTypes.VALIDATION,
                'Không tìm thấy kênh giveaway để công bố.', { channelId: giveaway.channelId });
        }
        const giveawayMessage = await channel.messages.fetch(messageId).catch(() => null);
        if (!giveawayMessage) {
            throw new TitanBotError('Giveaway message unavailable', ErrorTypes.VALIDATION,
                'Không tìm thấy tin nhắn giveaway gốc.', { messageId });
        }

        giveaway.winnerIds = winners;
        giveaway.ended = true;
        giveaway.isEnded = true;
        giveaway.endedAt = new Date().toISOString();
        giveaway.endedBy = giveaway.endedBy || interaction.user.id;
        giveaway.announcementPending = false;
        await saveGiveaway(interaction.client, interaction.guildId, giveaway);

        const isV2 = giveawayMessage.flags?.has(MessageFlags.IsComponentsV2) || (!giveawayMessage.embeds?.length && giveawayMessage.components?.length > 0);
        if (isV2) {
            const container = createGiveawayContainer(giveaway, 'ended', winners);
            await giveawayMessage.edit({
                content: null,
                embeds: [],
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        } else {
            await giveawayMessage.edit({
                content: '<a:chiikawag7:1541427343216738414> 𝓔𝓷𝓭 <a:chiikawag7:1541427343216738414>',
                embeds: [createGiveawayEmbed(giveaway, 'ended', winners)],
                components: [createGiveawayButtons(true)]
            });
        }

        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
        const resultMessage = await channel.send({
            content:
                `<a:chiikawag7:1541427343216738414> **Chúc mừng ${winnerMentions}!**\n` +
                `Bạn đã trúng **${giveaway.prize || 'phần thưởng'}**! <a:giftg1:1543150714732412948>\n` +
                'Vui lòng mở ticket để nhận phần thưởng.'
        });
        giveaway.winnerPingMessageId = resultMessage.id;
        giveaway.pendingWinnerIds = [];
        giveaway.pendingWinnerSelectedBy = null;
        giveaway.pendingWinnerSelectedAt = null;
        await saveGiveaway(interaction.client, interaction.guildId, giveaway);

        return InteractionHelper.safeReply(interaction, {
            embeds: [successEmbed('Đã công bố người thắng', `Thông báo đã được gửi tại ${channel}.`)],
            flags: MessageFlags.Ephemeral
        });
    }
};
