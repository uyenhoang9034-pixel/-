import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    EmbedBuilder,
    AttachmentBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} from 'discord.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { sanitizeInput } from '../../utils/validation.js';

const USAGI_PINK = '#FFB7D5';

const EMOJIS = {
    titleLeft: '<a:trangtrig2:1546040703375904801>',
    titleRight: '<a:trangtrig3:1546040818261954610>',
    bunny: '<a:bunnyg4:1541439959385374760>',
    heart: '<a:heartg3:1546047728314884226>',
    bullet: '<a:trangtrig6:1546043036390260756>',
    link: '<a:trangtrig13:1546047657963819048>',
};

const TEXT_CHANNEL_TYPES = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
];

function resolveTargetChannel(interaction) {
    const selected = interaction.options.getChannel('channel');
    if (selected) {
        return selected;
    }

    if (!interaction.channel || !TEXT_CHANNEL_TYPES.includes(interaction.channel.type)) {
        return null;
    }

    return interaction.channel;
}

export function createSay2Container({
    title,
    message,
    guildName,
    customFooter,
    attachment,
}) {
    const container = new ContainerBuilder();

    // 1. Header Title
    const headerTitle = title.startsWith('#') ? title : `# ${title}`;
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(headerTitle),
    );

    // 2. Separator
    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
    );

    // 3. Message Body (nếu có nội dung chữ)
    if (message && message.trim().length > 0) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(message),
        );

        if (attachment && attachment.contentType?.startsWith('image/')) {
            container.addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small),
            );
        }
    }

    // 4. Image Attachment if present
    if (attachment && attachment.contentType?.startsWith('image/')) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(attachment.url),
            ),
        );
    }

    // 5. Separator
    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
    );

    // 6. Subtext Footer
    const footerText = customFooter || `${guildName} • 𝓤𝓼𝓪𝓰𝓲`;
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${footerText}`),
    );

    return container;
}

export default {
    data: new SlashCommandBuilder()
        .setName('say2')
        .setDescription('Gửi tin nhắn dưới dạng giao diện mới Discord Components V2')
        .addStringOption((option) =>
            option
                .setName('message')
                .setDescription('Nội dung tin nhắn bot cần nói (hỗ trợ xuống dòng hoặc gõ \\n)')
                .setRequired(false)
                .setMaxLength(2000),
        )
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Kênh cần gửi đến (mặc định: kênh hiện tại)')
                .addChannelTypes(...TEXT_CHANNEL_TYPES)
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('title')
                .setDescription('Tiêu đề cho thông báo (tùy chọn)')
                .setRequired(false)
                .setMaxLength(256),
        )
        .addAttachmentOption((option) =>
            option
                .setName('image')
                .setDescription('Ảnh hoặc tệp đính kèm gửi cùng tin nhắn (tùy chọn)')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('footer')
                .setDescription('Chân trang tùy chỉnh (tùy chọn)')
                .setRequired(false)
                .setMaxLength(128),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    category: 'moderation',
    abuseProtection: { maxAttempts: 8, windowMs: 60_000 },

    async execute(interaction, _config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferSuccess) {
            logger.warn('Say2 interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'say2',
            });
            return;
        }

        const rawMessage = interaction.options.getString('message') || '';
        const unescapedMessage = rawMessage
            .replace(/\\r\\n/g, '\n')
            .replace(/\\n/g, '\n');
        const message = sanitizeInput(unescapedMessage, 2000, true);
        const customTitle = interaction.options.getString('title');
        const customFooter = interaction.options.getString('footer');
        const attachment = interaction.options.getAttachment('image');

        if (!message && !attachment) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Vui lòng nhập nội dung tin nhắn hoặc đính kèm ảnh/tệp cần gửi.',
            });
        }

        const channel = resolveTargetChannel(interaction);
        if (!channel) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Vui lòng chọn một kênh văn bản hoặc chạy lệnh trực tiếp trong kênh đó.',
            });
        }

        const memberPermissions = channel.permissionsFor(interaction.member);
        const botPermissions = channel.permissionsFor(interaction.guild.members.me);

        if (!memberPermissions?.has(PermissionFlagsBits.SendMessages)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `Chị không có quyền gửi tin nhắn trong kênh ${channel}.`,
            });
        }

        if (!botPermissions?.has(PermissionFlagsBits.SendMessages)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `Em không có quyền gửi tin nhắn trong kênh ${channel}. Chị cấp thêm quyền cho em với nhé!`,
            });
        }

        if (attachment && !botPermissions?.has(PermissionFlagsBits.AttachFiles)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `Em không có quyền đính kèm tệp (Attach Files) trong kênh ${channel}.`,
            });
        }

        const finalTitle = customTitle
            ? `${EMOJIS.titleLeft} **${customTitle}** ${EMOJIS.titleRight}`
            : '<a:trangtrig2:1546040703375904801> **USAGI THÔNG BÁO** <a:trangtrig3:1546040818261954610>';

        const container = createSay2Container({
            title: finalTitle,
            message,
            guildName: interaction.guild.name,
            customFooter,
            attachment,
        });

        const nonImageFiles = [];
        const allFiles = [];
        if (attachment) {
            const att = new AttachmentBuilder(attachment.url, {
                name: attachment.name,
            });
            allFiles.push(att);
            if (!attachment.contentType?.startsWith('image/')) {
                nonImageFiles.push(att);
            }
        }

        let sentMessage;
        try {
            sentMessage = await channel.send({
                content: null,
                embeds: [],
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                files: nonImageFiles,
            });
        } catch (v2Error) {
            logger.warn('Failed to send Say2 message with Components V2, falling back to Embed:', v2Error);
            const fallbackEmbed = new EmbedBuilder()
                .setColor(USAGI_PINK)
                .setTitle(finalTitle.replace(/^#\s*/, ''))
                .setFooter({
                    text: customFooter || `${interaction.guild.name} • 𝓤𝓼𝓪𝓰𝓲`,
                    iconURL: client.user.displayAvatarURL(),
                })
                .setTimestamp();

            if (message && message.trim().length > 0) {
                fallbackEmbed.setDescription(message);
            }

            if (attachment && attachment.contentType?.startsWith('image/')) {
                fallbackEmbed.setImage(attachment.url);
            }

            sentMessage = await channel.send({
                embeds: [fallbackEmbed],
                files: allFiles,
            });
        }

        await logEvent({
            client,
            guild: interaction.guild,
            event: {
                action: 'Bot Say2 Message Sent',
                target: `${channel} (${channel.id})`,
                executor: `${interaction.user.tag} (${interaction.user.id})`,
                reason: message
                    ? (message.length > 200 ? `${message.slice(0, 197)}...` : message)
                    : (attachment ? `Gửi tệp/ảnh: ${attachment.name}` : 'Không có nội dung'),
                metadata: {
                    channelId: channel.id,
                    messageId: sentMessage.id,
                    moderatorId: interaction.user.id,
                    isComponentsV2: true,
                    hasAttachment: Boolean(attachment),
                    customTitle: customTitle || 'None',
                    messageLength: message ? message.length : 0,
                },
            },
        });

        const previewMessage = message
            ? (message.length > 250 ? `${message.slice(0, 247)}...` : message)
            : null;
        const quotedPreview = previewMessage
            ? previewMessage
                .split('\n')
                .map((line) => `> ${line}`)
                .join('\n')
            : '> *(Không có chữ - chỉ gửi tệp/ảnh)*';

        const confirmDescription = [
            `Em đã gửi tin nhắn giao diện mới của chị vào ${channel} thành công mĩ mãn rồi nha! ${EMOJIS.heart}`,
            '',
            `${EMOJIS.bullet} **Kênh gửi:** ${channel}`,
            `${EMOJIS.bullet} **Định dạng:** 🌟 Discord Components V2 (Giao diện mới)`,
            customTitle ? `${EMOJIS.bullet} **Tiêu đề:** ${customTitle}` : null,
            attachment ? `${EMOJIS.bullet} **Tệp đính kèm:** [${attachment.name}](${attachment.url})` : null,
            `${EMOJIS.link} **Xem tin nhắn:** [Bấm vào đây để tới tin nhắn](${sentMessage.url})`,
            '',
            '**Nội dung đã gửi:**',
            quotedPreview,
        ]
            .filter(Boolean)
            .join('\n');

        const confirmEmbed = new EmbedBuilder()
            .setColor(USAGI_PINK)
            .setTitle(`${EMOJIS.bunny} 𝓤𝓼𝓪𝓰𝓲 · Đã Gửi Lời Nhắn Giao Diện Mới Xong Rồi Nè!`)
            .setDescription(confirmDescription)
            .setFooter({
                text: `${interaction.guild.name} • 𝓤𝓼𝓪𝓰𝓲 múp rụp`,
                iconURL: client.user.displayAvatarURL(),
            })
            .setTimestamp();

        return await InteractionHelper.safeEditReply(interaction, {
            embeds: [confirmEmbed],
            flags: MessageFlags.Ephemeral,
        });
    },
};
