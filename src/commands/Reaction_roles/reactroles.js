import {
    AttachmentBuilder,
    ChannelType,
    ContainerBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} from 'discord.js';

import fs from 'fs';
import path from 'path';

import {
    fileURLToPath,
} from 'url';

import {
    GAME_ROLES,
    GAME_ROLE_EMBED_COLOR,
    getEmojiDisplay,
} from '../../config/gameRoles.js';

import {
    addAllGameRoleReactions,
    getGameRolePanel,
    saveGameRolePanel,
} from '../../services/gameRoleService.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

import {
    logger,
} from '../../utils/logger.js';


const __filename =
    fileURLToPath(
        import.meta.url,
    );

const __dirname =
    path.dirname(
        __filename,
    );


/**
 * =========================================================
 * GET ROLE IMAGE (Catbox CDN)
 * =========================================================
 */

const GET_ROLE_IMAGE_URL =
    'https://files.catbox.moe/39y3wa.png';


/**
 * =========================================================
 * PANEL TEXT
 * =========================================================
 */

const PANEL_TITLE =
    '<a:trangtrig2:1546040703375904801> **GÓC LẤY ROLE** <a:trangtrig3:1546040818261954610>';


/**
 * =========================================================
 * BUILD ROLE LIST
 * =========================================================
 *
 * Format:
 *
 * ⌞emoji⌝ │@Role
 */

function buildRoleList() {
    const gameNames = {
        tft: 'Teamfight Tactics',
        valorant: 'Valorant',
        goose_goose_duck: 'Goose Goose Duck',
        lien_quan_mobile: 'Liên Quân Mobile',
        wuthering_waves: 'Wuthering Waves',
        genshin_impact: 'Genshin Impact',
        pubg: 'PUBG',
        roblox: 'Roblox',
        minecraft: 'Minecraft',
        other_games: 'Các Game Khác',
        no_game: 'Không Thích Chơi Game',
    };

    return GAME_ROLES
        .map(
            (config) =>
                `⌞${getEmojiDisplay(config)}⌝ │${gameNames[config.key] ?? config.label}`,
        )
        .join('\n');
}


/**
 * =========================================================
 * BUILD PANEL DESCRIPTION
 * =========================================================
 */

function buildPanelDescription() {
    const roleList =
        buildRoleList();

    return [
        '<a:trangtrig30:1546905942476464178> Hãy chắc chắn bạn đã đọc kĩ rules trước khi lấy role.',
        '',
        '<a:trangtrig30:1546905942476464178>  Ấn emoji để chọn game, chơi nhiều game chọn nhiều emoji, không chơi game nào thì chọn "không thích chơi game".',
        '',
        '<a:bang2:1546891483250954290> Nếu không pick role sẽ không xem được kênh nào vì toàn bộ đều là kênh ẩn!',
        '',
        roleList,
        '',
        '<a:bang2:1546891483250954290> Đừng quên ghé kênh <#1541364885789745213> để lại thông tin và nhận biệt danh siêu cấp vip pro nhé! Xin cảm ơn! <a:heartg1:1545307544808071258>',
    ]
        .join('\n');
}


/**
 * =========================================================
 * BOT PERMISSION CHECK
 * =========================================================
 */

function getMissingChannelPermissions(
    channel,
    botMember,
) {
    const permissions =
        channel.permissionsFor(
            botMember,
        );

    if (!permissions) {
        return [
            'View Channel',
            'Send Messages',
            'Embed Links',
            'Add Reactions',
            'Read Message History',
        ];
    }

    const checks = [
        [
            PermissionFlagsBits.ViewChannel,
            'View Channel',
        ],

        [
            PermissionFlagsBits.SendMessages,
            'Send Messages',
        ],

        [
            PermissionFlagsBits.EmbedLinks,
            'Embed Links',
        ],

        [
            PermissionFlagsBits.AddReactions,
            'Add Reactions',
        ],

        [
            PermissionFlagsBits.AttachFiles,
            'Attach Files',
        ],

        [
            PermissionFlagsBits.ReadMessageHistory,
            'Read Message History',
        ],
    ];

    return checks
        .filter(
            ([permission]) =>
                !permissions.has(
                    permission,
                ),
        )
        .map(
            ([, label]) =>
                label,
        );
}


/**
 * =========================================================
 * VALIDATE GAME ROLES
 * =========================================================
 */

async function validateConfiguredRoles(
    guild,
) {
    const botMember =
        guild.members.me ??
        await guild.members
            .fetchMe()
            .catch(
                () =>
                    null,
            );

    if (!botMember) {
        throw new Error(
            'Không thể lấy thông tin bot member trong server.',
        );
    }

    if (
        !botMember.permissions.has(
            PermissionFlagsBits.ManageRoles,
        )
    ) {
        throw new Error(
            'Bot chưa có quyền Manage Roles.',
        );
    }

    const invalidRoles = [];

    for (
        const config
        of GAME_ROLES
    ) {
        const role =
            guild.roles.cache.get(
                config.roleId,
            ) ??
            await guild.roles
                .fetch(
                    config.roleId,
                )
                .catch(
                    () =>
                        null,
                );

        if (!role) {
            invalidRoles.push(
                `${config.label}: role không tồn tại (${config.roleId})`,
            );

            continue;
        }

        if (
            role.managed
        ) {
            invalidRoles.push(
                `${config.label}: đây là managed role`,
            );

            continue;
        }

        if (
            role.position >=
            botMember.roles.highest.position
        ) {
            invalidRoles.push(
                `${config.label}: role đang cao hơn hoặc bằng role cao nhất của bot`,
            );
        }
    }

    if (
        invalidRoles.length > 0
    ) {
        throw new Error(
            [
                'Một số game role chưa thể được bot quản lý:',
                '',
                ...invalidRoles,
            ].join('\n'),
        );
    }

    return botMember;
}


/**
 * =========================================================
 * VALIDATE CUSTOM EMOJIS
 * =========================================================
 */

async function validateCustomEmojis(
    client,
) {
    const missing = [];

    for (
        const config
        of GAME_ROLES
    ) {
        if (
            !config.emoji?.id
        ) {
            continue;
        }

        let emoji =
            client.emojis.cache.get(
                config.emoji.id,
            );

        if (!emoji) {
            for (const guild of client.guilds.cache.values()) {
                emoji = await guild.emojis.fetch(config.emoji.id).catch(() => null);
                if (emoji) break;
            }
        }

        if (!emoji) {
            missing.push(
                `${config.label}: ${config.emoji.id}`,
            );
        }
    }

    if (
        missing.length > 0
    ) {
        logger.warn(
            [
                'Một số custom emoji chưa tìm thấy trong cache của bot (sẽ thử phản ứng trực tiếp qua API):',
                ...missing,
            ].join('\n'),
        );
    }
}


/**
 * =========================================================
 * DELETE OLD PANEL
 * =========================================================
 *
 * Khi chạy /reactroles setup lại:
 *
 * - panel mới được tạo
 * - lưu panel mới
 * - panel cũ được xóa
 *
 * Tránh tồn tại hai bài Get Role cùng hoạt động.
 */

async function deletePreviousPanel(
    interaction,
    previousPanel,
    newMessageId,
) {
    if (
        !previousPanel ||
        previousPanel.messageId ===
            newMessageId
    ) {
        return;
    }

    try {
        const oldChannel =
            interaction.guild.channels.cache.get(
                previousPanel.channelId,
            ) ??
            await interaction.guild.channels
                .fetch(
                    previousPanel.channelId,
                )
                .catch(
                    () =>
                        null,
                );

        if (
            !oldChannel ||
            !oldChannel.isTextBased?.()
        ) {
            return;
        }

        const oldMessage =
            await oldChannel.messages
                .fetch(
                    previousPanel.messageId,
                )
                .catch(
                    () =>
                        null,
                );

        if (
            oldMessage &&
            oldMessage.id !==
                newMessageId
        ) {
            await oldMessage
                .delete()
                .catch(
                    () =>
                        null,
                );
        }

    } catch (error) {
        logger.warn(
            'Could not delete previous Get Role panel:',
            error,
        );
    }
}


/**
 * =========================================================
 * COMMAND
 * =========================================================
 */

export default {

    data:
        new SlashCommandBuilder()
            .setName(
                'reactroles',
            )
            .setDescription(
                'Quản lý hệ thống Game Roles',
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator,
            )
            .addSubcommand(
                (
                    subcommand,
                ) =>
                    subcommand
                        .setName(
                            'setup',
                        )
                        .setDescription(
                            'Đăng panel Get Roles',
                        )
                        .addChannelOption(
                            (
                                option,
                            ) =>
                                option
                                    .setName(
                                        'channel',
                                    )
                                    .setDescription(
                                        'Kênh đăng bảng Get Roles',
                                    )
                                    .addChannelTypes(
                                        ChannelType.GuildText,
                                        ChannelType.GuildAnnouncement,
                                    )
                                    .setRequired(
                                        true,
                                    ),
                        ),
            ),


    /**
     * =====================================================
     * EXECUTE
     * =====================================================
     */

    async execute(
        interaction,
    ) {
        const subcommand =
            interaction.options.getSubcommand();

        if (
            subcommand !==
            'setup'
        ) {
            return;
        }


        const deferred =
            await InteractionHelper.safeDefer(
                interaction,
                {
                    flags:
                        MessageFlags.Ephemeral,
                },
            );

        if (!deferred) {
            return;
        }


        try {
            if (
                !interaction.guild
            ) {
                throw new Error(
                    'Lệnh này chỉ dùng được trong server.',
                );
            }


            /**
             * =============================================
             * CHANNEL
             * =============================================
             */

            const channel =
                interaction.options.getChannel(
                    'channel',
                    true,
                );


            /**
             * =============================================
             * ROLE VALIDATION
             * =============================================
             */

            const botMember =
                await validateConfiguredRoles(
                    interaction.guild,
                );


            /**
             * =============================================
             * CHANNEL PERMISSIONS
             * =============================================
             */

            const missingPermissions =
                getMissingChannelPermissions(
                    channel,
                    botMember,
                );

            if (
                missingPermissions.length >
                0
            ) {
                throw new Error(
                    `Bot đang thiếu quyền trong ${channel}: ${missingPermissions.join(', ')}`,
                );
            }


            /**
             * =============================================
             * EMOJI VALIDATION
             * =============================================
             */

            await validateCustomEmojis(
                interaction.client,
            );


            /**
             * =============================================
             * OLD PANEL
             * =============================================
             */

            const previousPanel =
                await getGameRolePanel(
                    interaction.client,
                    interaction.guildId,
                );


            /**
             * =============================================
             * CONTAINER (DISCORD COMPONENTS V2)
             * =============================================
             */

            const container = new ContainerBuilder();

            // 1. Tiêu đề chính
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${PANEL_TITLE}`,
                ),
            );

            // 2. Thanh phân cách ngang
            container.addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small),
            );

            // 3. Nội dung mô tả và danh sách role
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    buildPanelDescription(),
                ),
            );

            // 4. Ảnh banner getrole.png dạng Media Gallery bên dưới văn bản
            const roleAssetDir =
                path.resolve(
                    __dirname,
                    '../../../assets/role',
                );

            const getRoleImagePath =
                path.join(
                    roleAssetDir,
                    'getrole.png',
                );

            const files = [];
            let imageUrl = null;

            if (
                fs.existsSync(
                    getRoleImagePath,
                )
            ) {
                files.push(
                    new AttachmentBuilder(
                        getRoleImagePath,
                        {
                            name:
                                'getrole.png',
                        },
                    ),
                );

                imageUrl =
                    'attachment://getrole.png';
            } else if (
                GET_ROLE_IMAGE_URL
            ) {
                imageUrl =
                    GET_ROLE_IMAGE_URL;
            }

            if (imageUrl) {
                container.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(imageUrl)
                            .setDescription('Get Roles'),
                    ),
                );
            }


            /**
             * =============================================
             * SEND PANEL
             * =============================================
             */

            const message =
                await channel.send({
                    content: null,
                    embeds: [],
                    components: [
                        container,
                    ],
                    files,
                    flags:
                        MessageFlags.IsComponentsV2,
                    allowedMentions: {
                        parse: [],
                    },
                });


            /**
             * =============================================
             * SAVE PANEL
             * =============================================
             */

            try {
                await saveGameRolePanel(
                    interaction.client,
                    interaction.guildId,
                    {
                        channelId:
                            channel.id,

                        messageId:
                            message.id,

                        createdAt:
                            new Date().toISOString(),
                    },
                );

            } catch (error) {
                await message
                    .delete()
                    .catch(
                        () =>
                            null,
                    );

                throw error;
            }


            /**
             * =============================================
             * ADD 11 REACTIONS
             * =============================================
             */

            await addAllGameRoleReactions(
                message,
            );


            /**
             * =============================================
             * REMOVE PREVIOUS PANEL
             * =============================================
             */

            await deletePreviousPanel(
                interaction,
                previousPanel,
                message.id,
            );


            /**
             * =============================================
             * LOG
             * =============================================
             */

            logger.info(
                `Game Role panel created by ${interaction.user.tag}: ${message.id} in ${channel.id}`,
            );


            /**
             * =============================================
             * SUCCESS
             * =============================================
             */

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                GAME_ROLE_EMBED_COLOR,
                            )
                            .setDescription(
                                `✅ Đã tạo **Get Roles** tại ${channel}.\n\n${message.url}`,
                            ),
                    ],
                },
            );

        } catch (error) {
            logger.error(
                'Failed to create Get Role panel:',
                error,
            );

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                0xed4245,
                            )
                            .setTitle(
                                '❌ Không thể tạo Get Roles',
                            )
                            .setDescription(
                                String(
                                    error?.message ??
                                    error,
                                ).slice(
                                    0,
                                    4000,
                                ),
                            ),
                    ],
                },
            );
        }
    },
};
