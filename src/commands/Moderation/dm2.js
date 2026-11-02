import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
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

const USAGI_PINK = '#FFB7D5';

const EMOJIS = {
    titleLeft: '<a:trangtrig2:1546040703375904801>',
    titleRight: '<a:trangtrig3:1546040818261954610>',
    bunny: '<a:bunnyg4:1541439959385374760>',
    heartG1: '<a:heartg1:1545307544808071258>',
    heartG3: '<a:heartg3:1546047728314884226>',
    bullet: '<a:trangtrig6:1546043036390260756>',
    time: '<a:trangtrig41:1547238037832863744>',
    warning: '<a:bang2:1546891483250954290>',
    catSad: '<a:catg11:1546058047393239151>',
};

export function createDm2Container({
    dmTitle,
    targetUser,
    senderDisplayName,
    decorLines,
    guildName,
    authorName,
    attachment,
}) {
    const container = new ContainerBuilder();

    if (authorName) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${authorName}**`),
        );
    }

    const formattedTitle = dmTitle.startsWith('#')
        ? dmTitle
        : `# ${dmTitle}`;

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(formattedTitle),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
    );

    const greetingAndBody = [
        `Chào <@${targetUser.id}> ${EMOJIS.bunny}, bạn có một lời nhắn từ ${senderDisplayName}:`,
        '',
        ...decorLines,
    ].join('\n');

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(greetingAndBody),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
    );

    const footerText = [
        `${EMOJIS.heartG3} **Máy chủ gửi:** ${guildName}`,
        `${EMOJIS.time} **Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`,
        '',
        '-# Tin nhắn từ Usagi • Không thể phản hồi trực tiếp tin nhắn này',
    ].join('\n');

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(footerText),
    );

    if (attachment && attachment.contentType?.startsWith('image/')) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(attachment.url),
            ),
        );
    }

    return container;
}

export default {
    data: new SlashCommandBuilder()
        .setName('dm2')
        .setDescription('Gửi link Decor/quà tặng tự động theo mẫu tới thành viên (Dành cho Staff)')
        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('Thành viên bạn muốn gửi link decor')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('link')
                .setDescription('Link quà tặng / Decor Discord (vd: https://discord.gift/...)')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('title')
                .setDescription('Tiêu đề tùy chỉnh cho tin nhắn (Mặc định: SENT DECOR)')
                .setRequired(false)
                .setMaxLength(256),
        )
        .addBooleanOption((option) =>
            option
                .setName('anonymous')
                .setDescription('Gửi dưới danh nghĩa Ban Quản Trị (Mặc định: Đúng)')
                .setRequired(false),
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
            logger.warn('DM2 interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'dm2',
            });
            return;
        }

        const targetUser = interaction.options.getUser('user');
        const rawLink = interaction.options.getString('link');
        const customTitle = interaction.options.getString('title');
        const anonymousOption = interaction.options.getBoolean('anonymous');
        const anonymous = anonymousOption ?? true;
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
                        `Em không thể gửi link decor cho tài khoản bot được đâu ạ! ${EMOJIS.catSad}`,
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

            if (!rawLink || rawLink.trim().length === 0) {
                return await replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'Link decor không được để trống.',
                });
            }

            let formattedLink = rawLink.trim();
            if (!/^https?:\/\//i.test(formattedLink)) {
                formattedLink = `https://${formattedLink}`;
            }

            const titleText = customTitle?.trim() || 'SENT DECOR';
            const dmTitle = `${EMOJIS.titleLeft} **${titleText}** ${EMOJIS.titleRight}`;

            const senderDisplayName = anonymous
                ? '**Ban Quản Trị**'
                : `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`;

            const decorLines = [
                `${EMOJIS.heartG1} Hello đây là link decor của bạn, xin vui lòng ấn nhận trong thời gian sớm nhất để tránh trường hợp link hết hạn. Bọn mình sẽ không chịu trách nhiệm nếu link hết hạn mà bạn vẫn chưa nhận.`,
                `${EMOJIS.heartG1} ${formattedLink}`,
                `${EMOJIS.heartG1} Sau khi nhận xong, xin vui lòng check ticket và feedback theo hướng dẫn trong ticket giúp bọn mình.`,
                `${EMOJIS.warning} Lưu ý: Nếu không feedback, bạn sẽ không thể nhận phần thưởng cho lần sau. Xin cảm ơn ạ!`,
            ];

            const authorName = anonymous
                ? `Ban Quản Trị • ${interaction.guild.name}`
                : `${interaction.user.tag} • ${interaction.guild.name}`;

            const dmDescription = [
                `Chào <@${targetUser.id}> ${EMOJIS.bunny}, bạn có một lời nhắn từ ${senderDisplayName}:`,
                '',
                ...decorLines,
                '',
                `${EMOJIS.heartG3} **Máy chủ gửi:** ${interaction.guild.name}`,
                `${EMOJIS.time} **Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            ].join('\n');

            const dmEmbed = new EmbedBuilder()
                .setColor(USAGI_PINK)
                .setTitle(dmTitle)
                .setDescription(dmDescription)
                .setAuthor({
                    name: authorName,
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
            const dmNonImageFiles = [];
            if (attachment) {
                if (attachment.contentType?.startsWith('image/')) {
                    dmEmbed.setImage(attachment.url);
                } else {
                    const fileObj = new AttachmentBuilder(attachment.url, {
                        name: attachment.name,
                    });
                    dmFiles.push(fileObj);
                    dmNonImageFiles.push(fileObj);
                }
            }

            const container = createDm2Container({
                dmTitle,
                targetUser,
                senderDisplayName,
                decorLines,
                guildName: interaction.guild.name,
                authorName,
                attachment,
            });

            const dmChannel = await targetUser.createDM();
            try {
                await dmChannel.send({
                    content: null,
                    embeds: [],
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    files: dmNonImageFiles,
                });
            } catch (v2Error) {
                logger.warn('Failed to send DM2 with Components V2 container, falling back to Embed:', v2Error);
                await dmChannel.send({
                    embeds: [dmEmbed],
                    files: dmFiles,
                });
            }

            await logEvent({
                client: interaction.client,
                guild: interaction.guild,
                event: {
                    action: 'DM2 Sent (Decor Template)',
                    target: `${targetUser.tag} (${targetUser.id})`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    reason: `Anonymous: ${anonymous ? 'Yes' : 'No'} | Link: ${formattedLink}`,
                    metadata: {
                        userId: targetUser.id,
                        moderatorId: interaction.user.id,
                        anonymous,
                        link: formattedLink,
                        hasAttachment: Boolean(attachment),
                        customTitle: titleText,
                    },
                },
            });

            const successDescription = [
                `Em đã thay mặt chị gửi link decor tới <@${targetUser.id}> theo mẫu rồi nha! ${EMOJIS.heartG1}`,
                '',
                `${EMOJIS.bullet} **Người nhận:** <@${targetUser.id}> (\`${targetUser.tag}\`)`,
                `${EMOJIS.bullet} **Chế độ:** ${anonymous ? '🕵️‍♂️ Ẩn danh (Ban Quản Trị)' : '👤 Công khai danh tính'}`,
                `${EMOJIS.bullet} **Link decor:** ${formattedLink}`,
                customTitle ? `${EMOJIS.bullet} **Tiêu đề:** ${titleText}` : null,
                attachment ? `${EMOJIS.bullet} **Tệp đính kèm:** [${attachment.name}](${attachment.url})` : null,
                `${EMOJIS.time} **Thời gian gửi:** <t:${Math.floor(Date.now() / 1000)}:R>`,
            ]
                .filter(Boolean)
                .join('\n');

            const successEmbedReply = new EmbedBuilder()
                .setColor(USAGI_PINK)
                .setTitle(`${EMOJIS.bunny} 𝓤𝓼𝓪𝓰𝓲 · Đã Gửi Decor Thành Công!`)
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
            logger.error('DM2 command error:', error);

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
                message: `Lỗi khi gửi DM2: ${error.message}`,
            });
        }
    },
};

