import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
import { sendTicketTranscript } from '../../services/ticket.js';
import { getTicketData } from '../../utils/database.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';

export default {
    data: new SlashCommandBuilder()
        .setName("transcript")
        .setDescription("Xuất và gửi bù transcript cho ticket (mặc định kênh hiện tại).")
        .setDMPermission(false)
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription("Kênh ticket cần xuất transcript (mặc định là kênh hiện tại).")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false),
        ),
    category: "ticket",

    async execute(interaction, guildConfig, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) {
            return;
        }

        const targetChannel = interaction.options?.getChannel?.("channel") || interaction.channel;
        const ticketData = await getTicketData(interaction.guildId, targetChannel.id);

        if (!ticketData) {
            return await replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: `Kênh ${targetChannel} không phải là một kênh ticket hợp lệ trong hệ thống.`,
            });
        }

        const permissionContext = await getTicketPermissionContext({ client, interaction });
        if (!permissionContext.canManageTicket && !permissionContext.canCloseTicket && ticketData.userId !== interaction.user.id) {
            return await replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: 'Chỉ có Staff Ticket hoặc Ban Quản Trị mới có thể xuất transcript của ticket này.',
            });
        }

        const success = await sendTicketTranscript(
            targetChannel,
            ticketData,
            interaction.user,
            'manual',
            'Xuất bù transcript theo lệnh',
        );

        if (success) {
            const config = await getGuildConfig(client, interaction.guildId);
            const targetChannelId = config.ticketTranscriptChannelId || config.ticketLogsChannelId;
            const channelMention = targetChannelId ? `<#${targetChannelId}>` : 'kênh lưu trữ transcripts';

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "Xuất Transcript Thành Công",
                        `Đã xuất và gửi bù bản transcript HTML của ticket ${targetChannel} về ${channelMention} thành công rồi nha chị! 💕`,
                    ),
                ],
            });

            logger.info('Manual transcript exported successfully', {
                userId: interaction.user.id,
                channelId: targetChannel.id,
                guildId: interaction.guildId,
            });
        } else {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    warningEmbed(
                        "Không Thể Gửi Transcript",
                        `Không thể gửi transcript cho ticket ${targetChannel}. Vui lòng kiểm tra xem bot đã được cấu hình kênh lưu trữ transcript (\`/ticket dashboard\`) và có đủ quyền hạn trong kênh đó chưa nhé ạ!`,
                    ),
                ],
            });
        }
    },
};

