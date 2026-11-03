import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} from 'discord.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

import {
    replyUserError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

import {
    logger,
} from '../../utils/logger.js';

import {
    SETNICK_CONFIG,
    createSetnickPanelPayload,
} from '../../services/setnickService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setnickpanel')
        .setDescription('Gửi bảng tự đổi nickname cho thành viên.')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Kênh muốn gửi bảng (mặc định là kênh hiện tại).')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .setDMPermission(false),

    category: 'moderation',
    prefixOnly: false,

    async execute(interaction, config, client) {
        try {
            const guild = interaction.guild;
            if (!guild) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'Lệnh này chỉ có thể sử dụng trong server.',
                });
            }

            // Kiểm tra role quản lý hoặc quyền Admin
            const hasRole = interaction.member.roles.cache.has(SETNICK_CONFIG.managementRoleId);
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasRole && !isAdmin) {
                return replyUserError(interaction, {
                    type: ErrorTypes.PERMISSION,
                    message: 'Bạn không có role quản lý để gửi bảng tự đổi nickname.',
                });
            }

            const targetChannel =
                interaction.options.getChannel('channel') || interaction.channel;

            if (!targetChannel || !targetChannel.isTextBased()) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'Kênh được chọn không hợp lệ hoặc bot không thể gửi tin nhắn vào đó.',
                });
            }

            const payload = createSetnickPanelPayload();

            try {
                await targetChannel.send(payload.v2);
            } catch (v2Err) {
                logger.warn('[SetNickPanel] Failed to send V2 panel, using fallback embed:', v2Err);
                await targetChannel.send(payload.fallback);
            }

            return InteractionHelper.universalReply(interaction, {
                content: `<a:heartg1:1545307544808071258> Đã gửi bảng **TỰ ĐỔI NICKNAME** thành công tại ${targetChannel}!`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            logger.error('[SetNickPanel] Error executing command:', error);
            return replyUserError(interaction, {
                type: ErrorTypes.EXECUTION,
                message: 'Đã xảy ra lỗi khi gửi bảng tự đổi nickname. Vui lòng thử lại sau!',
            });
        }
    },
};
