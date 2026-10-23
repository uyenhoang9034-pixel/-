import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { sanitizeMarkdown } from '../../utils/validation.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

const USAGI_PINK = '#FFB7D5';

const EMOJIS = {
    titleLeft: '<a:trangtrig2:1546040703375904801>',
    titleRight: '<a:trangtrig3:1546040818261954610>',
    bunny: '<a:bunnyg4:1541439959385374760>',
    heart: '<a:heartg3:1546047728314884226>',
    bullet: '<a:trangtrig6:1546043036390260756>',
    warning: '<a:bang2:1546891483250954290>',
    catSad: '<a:catg11:1546058047393239151>',
};

export default {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Gửi tin nhắn riêng (DM) tới một thành viên (Dành cho Staff)')
        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('Thành viên bạn muốn gửi tin nhắn')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('message')
                .setDescription('Nội dung tin nhắn muốn gửi')
                .setRequired(true)
                .setMaxLength(2000),
        )
        .addBooleanOption((option) =>
            option
                .setName('anonymous')
                .setDescription('Gửi ẩn danh dưới danh nghĩa BQL (Mặc định: Không)')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('title')
                .setDescription('Tiêu đề tùy chỉnh cho tin nhắn (tùy chọn)')
                .setRequired(false)
                .setMaxLength(256),
        )
        .addAttachmentOption((option) =>
            option
                .setName('image')
                .setDescription('Ảnh hoặc tệp đính kèm gửi cùng tin nhắn (tùy chọn)')
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),
    category: 'moderation',

    async execute(interaction, _config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferSuccess) {
            logger.warn('DM interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'dm',
            });
            return;
        }

        const targetUser = interaction.options.getUser('user');
        const rawMessage = interaction.options.getString('message');
        const anonymous = interaction.options.getBoolean('anonymous') || false;
        const customTitle = interaction.options.getString('title');
        const attachment = interaction.options.getAttachment('image');

        try {
            if (!targetUser) {
                return await replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'Không tìm thấy người dùng này.',
                });
            }

            if (targetUser.bot) {
                const botErrorEmbed = new EmbedBuilder()
                    .setColor(USAGI_PINK)
                    .setTitle(`${EMOJIS.warning} 𝓤𝓼𝓪𝓰𝓲 · Không Thể Gửi Tin Nhắn`)
                    .setDescription(
                        `Em không thể gửi tin nhắn riêng cho tài khoản bot được đâu ạ! ${EMOJIS.catSad}`,
                    )
                    .setFooter({
                        text: 'Usagi múp rụp sẵn sàng hỗ trợ chị',
                        iconURL: client.user.displayAvatarURL(),
                    });

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [botErrorEmbed],
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (!rawMessage || rawMessage.trim().length === 0) {
                return await replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'Tin nhắn không được để trống.',
                });
            }

            const sanitized = sanitizeMarkdown(rawMessage);

            const dmTitle = customTitle
                ? `${EMOJIS.titleLeft} ${customTitle} ${EMOJIS.titleRight}`
                : `${EMOJIS.titleLeft} 𝓤𝓼𝓪𝓰𝓲 · 𝓣𝓱𝓸̂𝓷𝓰 𝓑𝓪́𝓸 ${EMOJIS.titleRight}`;

            const senderDisplayName = anonymous
                ? '**Ban Quản Trị**'
                : `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`;

            const dmDescription = [
                `Chào <@${targetUser.id}> ${EMOJIS.bunny}, bạn có một lời nhắn từ ${senderDisplayName}:`,
                '',
                '╭─────────────── ♡ ───────────────╮',
                sanitized,
                '╰─────────────── ♡ ───────────────╯',
                '',
                `${EMOJIS.heart} **Máy chủ gửi:** ${interaction.guild.name}`,
                `${EMOJIS.bullet} **Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            ].join('\n');

            const dmEmbed = new EmbedBuilder()
                .setColor(USAGI_PINK)
                .setTitle(dmTitle)
                .setDescription(dmDescription)
                .setAuthor({
                    name: anonymous
                        ? `Ban Quản Trị • ${interaction.guild.name}`
                        : `${interaction.user.tag} • ${interaction.guild.name}`,
                    iconURL: anonymous
                        ? interaction.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
                        : interaction.user.displayAvatarURL({ dynamic: true }),
                })
                .setFooter({
                    text: 'Tin nhắn từ Usagi • Không thể phản hồi trực tiếp tin nhắn này',
                    iconURL: client.user.displayAvatarURL(),
                })
                .setTimestamp();

            const dmFiles = [];
            if (attachment) {
                dmFiles.push(attachment);
                if (attachment.contentType?.startsWith('image/')) {
                    dmEmbed.setImage(attachment.url);
                }
            }

            const dmChannel = await targetUser.createDM();
            await dmChannel.send({
                embeds: [dmEmbed],
                files: dmFiles,
            });

            await logEvent({
                client: interaction.client,
                guild: interaction.guild,
                event: {
                    action: 'DM Sent',
                    target: `${targetUser.tag} (${targetUser.id})`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    reason: `Anonymous: ${anonymous ? 'Yes' : 'No'}`,
                    metadata: {
                        userId: targetUser.id,
                        moderatorId: interaction.user.id,
                        anonymous,
                        hasAttachment: Boolean(attachment),
                        customTitle: customTitle || 'None',
                        messageLength: sanitized.length,
                    },
                },
            });

            const successDescription = [
                `Em đã thay mặt chị gửi tin nhắn riêng tới <@${targetUser.id}> rồi nha! ${EMOJIS.heart}`,
                '',
                `${EMOJIS.bullet} **Người nhận:** <@${targetUser.id}> (\`${targetUser.tag}\`)`,
                `${EMOJIS.bullet} **Chế độ:** ${anonymous ? '🕵️‍♂️ Ẩn danh (Ban Quản Trị)' : '👤 Công khai danh tính'}`,
                customTitle ? `${EMOJIS.bullet} **Tiêu đề:** ${customTitle}` : null,
                attachment ? `${EMOJIS.bullet} **Tệp đính kèm:** [${attachment.name}](${attachment.url})` : null,
                `${EMOJIS.bullet} **Thời gian gửi:** <t:${Math.floor(Date.now() / 1000)}:R>`,
                '',
                '**Nội dung đã gửi:**',
                `> ${sanitized.length > 300 ? `${sanitized.slice(0, 297)}...` : sanitized}`,
            ]
                .filter(Boolean)
                .join('\n');

            const successEmbedReply = new EmbedBuilder()
                .setColor(USAGI_PINK)
                .setTitle(`${EMOJIS.bunny} 𝓤𝓼𝓪𝓰𝓲 · Đã Gửi Tin Nhắn Thành Công!`)
                .setDescription(successDescription)
                .setFooter({
                    text: `Em bot Usagi múp rụp sẵn sàng hỗ trợ • Logger ID: ${interaction.id}`,
                    iconURL: client.user.displayAvatarURL(),
                })
                .setTimestamp();

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbedReply],
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            logger.error('DM command error:', error);

            if (error.code === 50007) {
                const dmClosedEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle(`${EMOJIS.warning} 𝓤𝓼𝓪𝓰𝓲 · Không Thể Gửi Tin Nhắn`)
                    .setDescription(
                        `Em không thể gửi tin nhắn riêng cho <@${targetUser.id}> (\`${targetUser.tag}\`) được rồi ạ! ${EMOJIS.catSad}\n\n` +
                        '> Có thể bạn ấy đã tắt tin nhắn trực tiếp từ thành viên máy chủ (Direct Messages Closed) hoặc đã chặn bot mất tiêu rồi.',
                    )
                    .setFooter({
                        text: 'Usagi múp rụp xin lỗi vì sự bất tiện này nha',
                        iconURL: client.user.displayAvatarURL(),
                    });

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [dmClosedEmbed],
                    flags: MessageFlags.Ephemeral,
                });
            }

            return await replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: `Lỗi khi gửi DM: ${error.message}`,
            });
        }
    },
};