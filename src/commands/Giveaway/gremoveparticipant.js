import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord.js';
import { getGuildGiveaways, saveGiveaway, isGiveawayEnded } from '../../utils/giveaways.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { Mutex } from '../../utils/mutex.js';
import {
    createGiveawayEmbed,
    createGiveawayButtons,
} from '../../services/giveawayService.js';

const GIVEAWAY_ADMIN_ROLE_ID = '1541303749916754001';

export default {
    data: new SlashCommandBuilder()
        .setName('gremoveparticipant')
        .setDescription('Loại bỏ một người tham gia khỏi giveaway chỉ định.')
        .addStringOption((option) =>
            option
                .setName('messageid')
                .setDescription('Message ID của giveaway cần loại bỏ người tham gia.')
                .setRequired(true),
        )
        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('Người dùng cần loại bỏ khỏi giveaway.')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('userid')
                .setDescription('User ID cần loại bỏ (nếu không tag/chọn được user).')
                .setRequired(false),
        )
        .addBooleanOption((option) =>
            option
                .setName('block')
                .setDescription('Chặn người này tham gia lại giveaway này? (Mặc định: Có)')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('Lý do loại bỏ khỏi giveaway.')
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            throw new TitanBotError(
                'Giveaway remove participant command used outside guild',
                ErrorTypes.VALIDATION,
                'Lệnh này chỉ có thể sử dụng trong server.',
                { userId: interaction.user.id },
            );
        }

        const hasAdminRole = interaction.member?.roles?.cache?.has(GIVEAWAY_ADMIN_ROLE_ID);
        const hasManageGuild = interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);

        if (!hasAdminRole && !hasManageGuild) {
            await interaction.reply({
                content: '❌ Bạn không có quyền loại bỏ người tham gia giveaway (cần quyền Quản lý máy chủ hoặc Role Giveaway Admin).',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const messageId = interaction.options.getString('messageid', true).trim();
        const targetUser = interaction.options.getUser('user');
        const rawUserId = interaction.options.getString('userid');
        const block = interaction.options.getBoolean('block') ?? true;
        const reason = interaction.options.getString('reason')?.trim() || 'Không có lý do cụ thể';

        let targetUserId = targetUser?.id || (rawUserId ? rawUserId.replace(/[<@!>]/g, '').trim() : null);

        if (!targetUserId) {
            await interaction.reply({
                content: '❌ Vui lòng chọn người dùng qua tuỳ chọn `user` hoặc nhập ID qua `userid`.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (!/^\d{17,20}$/.test(targetUserId)) {
            await interaction.reply({
                content: '❌ User ID không hợp lệ. Vui lòng nhập đúng dãy 17-20 chữ số.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const lockKey = `giveaway:${messageId}`;

        try {
            await Mutex.runExclusive(lockKey, async () => {
                const giveaways = await getGuildGiveaways(
                    interaction.client,
                    interaction.guildId,
                );

                const giveaway = giveaways.find(
                    (item) => item?.messageId === messageId,
                );

                if (!giveaway) {
                    await interaction.reply({
                        content: '❌ Không tìm thấy giveaway có Message ID này trong server.',
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                const participants = Array.isArray(giveaway.participants)
                    ? giveaway.participants
                    : [];

                if (!participants.includes(targetUserId)) {
                    await interaction.reply({
                        content: `❌ Người dùng <@${targetUserId}> (\`${targetUserId}\`) không có trong danh sách tham gia của giveaway này.`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                // Loại bỏ người dùng khỏi danh sách participants của giveaway này
                giveaway.participants = participants.filter((id) => id !== targetUserId);

                // Quản lý danh sách bị chặn/loại (disqualified)
                if (block) {
                    giveaway.disqualified = Array.isArray(giveaway.disqualified)
                        ? giveaway.disqualified
                        : [];
                    if (!giveaway.disqualified.includes(targetUserId)) {
                        giveaway.disqualified.push(targetUserId);
                    }
                } else if (Array.isArray(giveaway.disqualified)) {
                    giveaway.disqualified = giveaway.disqualified.filter((id) => id !== targetUserId);
                }

                // Nếu người này từng được chọn trước qua /gselect
                if (Array.isArray(giveaway.pendingWinnerIds) && giveaway.pendingWinnerIds.includes(targetUserId)) {
                    giveaway.pendingWinnerIds = giveaway.pendingWinnerIds.filter((id) => id !== targetUserId);
                    if (giveaway.pendingWinnerIds.length === 0) {
                        giveaway.pendingWinnerSelectedBy = null;
                        giveaway.pendingWinnerSelectedAt = null;
                    }
                }

                // Nếu người này nằm trong winnerIds/winners (trường hợp giveaway đã kết thúc)
                let wasWinner = false;
                if (Array.isArray(giveaway.winnerIds) && giveaway.winnerIds.includes(targetUserId)) {
                    giveaway.winnerIds = giveaway.winnerIds.filter((id) => id !== targetUserId);
                    wasWinner = true;
                }
                if (Array.isArray(giveaway.winners) && giveaway.winners.includes(targetUserId)) {
                    giveaway.winners = giveaway.winners.filter((id) => id !== targetUserId);
                    wasWinner = true;
                }

                // Lưu lại vào database
                await saveGiveaway(interaction.client, interaction.guildId, giveaway);

                logger.info(
                    `User ${targetUserId} removed from giveaway ${messageId} in guild ${interaction.guildId} by ${interaction.user.tag} (block: ${block}, reason: ${reason})`,
                );

                // Cập nhật lại tin nhắn giveaway trên kênh Discord
                try {
                    const channel = await interaction.client.channels.fetch(giveaway.channelId).catch(() => null);
                    if (channel?.isTextBased()) {
                        const giveawayMessage = await channel.messages.fetch(messageId).catch(() => null);
                        if (giveawayMessage) {
                            const isEnded = giveaway.ended || giveaway.isEnded || isGiveawayEnded(giveaway);
                            const status = giveaway.announcementPending
                                ? 'pending'
                                : isEnded
                                    ? 'ended'
                                    : 'active';
                            const winners = giveaway.winnerIds || giveaway.winners || [];
                            const updatedEmbed = createGiveawayEmbed(giveaway, status, winners);
                            const updatedRow = createGiveawayButtons(isEnded);

                            await giveawayMessage.edit({
                                embeds: [updatedEmbed],
                                components: [updatedRow],
                            }).catch((err) => {
                                logger.warn(`Could not update giveaway embed after removing participant ${messageId}:`, err.message);
                            });
                        }
                    }
                } catch (err) {
                    logger.warn('Error updating giveaway message after participant removal:', err);
                }

                const responseEmbed = new EmbedBuilder()
                    .setColor(0xF4A6C1)
                    .setTitle('🎉 Đã loại bỏ người tham gia giveaway')
                    .setDescription(`Đã xóa thành công <@${targetUserId}> khỏi danh sách tham gia của giveaway này!`)
                    .addFields(
                        {
                            name: '👤 Người bị loại',
                            value: `<@${targetUserId}> (\`${targetUserId}\`)`,
                            inline: true,
                        },
                        {
                            name: '🎁 Phần thưởng',
                            value: String(giveaway.prize || 'Không xác định').slice(0, 1024),
                            inline: true,
                        },
                        {
                            name: '👥 Số người tham gia còn lại',
                            value: `${giveaway.participants.length} người`,
                            inline: true,
                        },
                        {
                            name: '🚫 Chặn tham gia lại',
                            value: block ? 'Đã chặn (không thể bấm tham gia lại)' : 'Không chặn',
                            inline: true,
                        },
                        {
                            name: '🆔 Giveaway Message ID',
                            value: `\`${messageId}\``,
                            inline: true,
                        },
                        {
                            name: '📝 Lý do',
                            value: reason,
                            inline: false,
                        },
                    )
                    .setFooter({
                        text: `Thực hiện bởi ${interaction.user.tag} • Bot Usagi`,
                    })
                    .setTimestamp();

                if (wasWinner) {
                    responseEmbed.addFields({
                        name: '⚠️ Lưu ý người thắng',
                        value: 'Người này từng nằm trong danh sách trúng thưởng. Bạn có thể dùng `/greroll` để bốc thăm lại người thắng mới!',
                        inline: false,
                    });
                }

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        embeds: [responseEmbed],
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await interaction.reply({
                        embeds: [responseEmbed],
                        flags: MessageFlags.Ephemeral,
                    });
                }
            });
        } catch (error) {
            logger.error('Error removing giveaway participant:', error);

            if (error instanceof TitanBotError) {
                throw error;
            }

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: '❌ Có lỗi khi loại bỏ người tham gia khỏi giveaway.',
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                await interaction.reply({
                    content: '❌ Có lỗi khi loại bỏ người tham gia khỏi giveaway.',
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    },
};
