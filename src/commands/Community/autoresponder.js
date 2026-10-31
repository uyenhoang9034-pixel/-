import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';

import {
    withErrorHandling,
    createError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

import {
    getGuildConfig,
} from '../../services/config/guildConfig.js';

import {
    getAutoresponderConfig,
    canManageAutoresponder,
    createBuilderSession,
    deleteAutoresponder,
    setManagerRole,
} from '../../services/autoresponder/autoresponderService.js';

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('autoresponder')
        .setDescription(
            'Manage automatic responses',
        )

        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription(
                    'Create a new autoresponder',
                )
                .addStringOption(option =>
                    option
                        .setName('keyword')
                        .setDescription(
                            'Keyword that triggers the response',
                        )
                        .setRequired(true)
                        .setMaxLength(100),
                )
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription(
                            'Who can trigger this response',
                        )
                        .setRequired(true)
                        .addChoices(
                            {
                                name: 'Everyone',
                                value: 'everyone',
                            },
                            {
                                name: 'Manager only',
                                value: 'manager',
                            },
                        ),
                )
                .addAttachmentOption(option =>
                    option
                        .setName('image')
                        .setDescription(
                            'Optional image',
                        )
                        .setRequired(false),
                )
                .addBooleanOption(option =>
                    option
                        .setName('delete_trigger')
                        .setDescription(
                            'Tự động xóa tin nhắn lệnh khi kích hoạt (ví dụ xóa tin nhắn lvup1)',
                        )
                        .setRequired(false),
                )
                .addBooleanOption(option =>
                    option
                        .setName('mention_target')
                        .setDescription(
                            'Tag người dùng được chỉ định (ví dụ: lvup1 @User sẽ tag @User)',
                        )
                        .setRequired(false),
                ),
        )

        .addSubcommand(sub =>
            sub
                .setName('list')
                .setDescription(
                    'List autoresponders',
                ),
        )

        .addSubcommand(sub =>
            sub
                .setName('delete')
                .setDescription(
                    'Delete an autoresponder',
                )
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription(
                            'Autoresponder ID',
                        )
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        )

        .addSubcommand(sub =>
            sub
                .setName('edit')
                .setDescription(
                    'Edit an autoresponder',
                )
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription(
                            'Autoresponder ID',
                        )
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        )

        .addSubcommand(sub =>
            sub
                .setName('setrole')
                .setDescription(
                    'Set the Manager Role',
                )
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription(
                            'Role allowed to use manager-only responders',
                        )
                        .setRequired(true),
                ),
        ),

    category: 'Community',

    execute: withErrorHandling(
        async interaction => {
            if (!interaction.inGuild()) {
                throw createError(
                    'Guild only',
                    ErrorTypes.PERMISSION,
                    'Lệnh này chỉ dùng được trong server.',
                );
            }

            const guildId =
                interaction.guild.id;

            const config =
                await getAutoresponderConfig(
                    interaction.client,
                    guildId,
                );

            if (
                !canManageAutoresponder(
                    interaction.member,
                    config,
                )
            ) {
                throw createError(
                    'Autoresponder permission denied',
                    ErrorTypes.PERMISSION,
                    'Bạn không có quyền quản lý autoresponder.',
                );
            }

            const subcommand =
                interaction.options.getSubcommand();

            if (
                subcommand === 'setrole'
            ) {
                if (
                    !canManageAutoresponder(
                        interaction.member,
                        config,
                    )
                ) {
                    throw createError(
                        'Manager role change denied',
                        ErrorTypes.PERMISSION,
                        'Chỉ Administrator, Manage Server hoặc Admin Autoresponder mới có thể đổi Manager Role.',
                    );
                }

                const role =
                    interaction.options.getRole(
                        'role',
                    );

                await setManagerRole(
                    interaction.client,
                    guildId,
                    role.id,
                );

                return InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            `✅ Manager Role đã được đặt thành ${role}.`,
                        flags:
                            MessageFlags.Ephemeral,
                    },
                );
            }

            if (
                subcommand === 'add'
            ) {
                const keyword =
                    interaction.options.getString(
                        'keyword',
                    );

                const type =
                    interaction.options.getString(
                        'type',
                    );

                const image =
                    interaction.options.getAttachment(
                        'image',
                    );

                const deleteTriggerOption =
                    interaction.options.getBoolean('delete_trigger');

                const mentionTargetOption =
                    interaction.options.getBoolean('mention_target');

                const response = {
                    content: '',
                    embeds: [],
                    files: image
                        ? [
                            {
                                attachment:
                                    image.url,
                                name:
                                    image.name ||
                                    'image',
                            },
                        ]
                        : [],
                    buttons: [],
                    deleteTrigger: deleteTriggerOption ?? false,
                    mentionTarget: mentionTargetOption ?? true,
                    allowedMentions: {
                        parse: ['users'],
                    },
                    reply: {
                        enabled: false,
                        mentionAuthor: false,
                    },
                };

                const session =
                    createBuilderSession({
                        userId:
                            interaction.user.id,
                        guildId,
                        mode: 'create',
                        keyword,
                        type,
                        response,
                    });

                await interaction.showModal(
                    buildInitialModal(
                        session.sessionId,
                        keyword,
                    ),
                );

                return;
            }

            if (
                subcommand === 'list'
            ) {
                const responders =
                    config.responders || [];

                if (
                    responders.length === 0
                ) {
                    return InteractionHelper.safeReply(
                        interaction,
                        {
                            content:
                                'Server chưa có autoresponder nào.',
                            flags:
                                MessageFlags.Ephemeral,
                        },
                    );
                }

                const lines =
                    responders.map(
                        responder =>
                            `\`${responder.id}\` • **${responder.displayKeyword || responder.keyword}** • ${responder.type === 'manager' ? 'Manager only' : 'Everyone'} • ${responder.enabled === false ? '🔴 Disabled' : '🟢 Enabled'}`,
                    );

                return InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            `📋 **Danh sách Autoresponder**\n\n${lines.join('\n')}`,
                        flags:
                            MessageFlags.Ephemeral,
                    },
                );
            }

            if (
                subcommand === 'delete'
            ) {
                const id =
                    interaction.options.getString(
                        'id',
                    );

                const result =
                    await deleteAutoresponder(
                        interaction.client,
                        guildId,
                        id,
                    );

                if (!result.success) {
                    throw createError(
                        'Autoresponder not found',
                        ErrorTypes.USER_INPUT,
                        'Không tìm thấy autoresponder này.',
                    );
                }

                return InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            `🗑️ Đã xóa autoresponder **${result.responder.displayKeyword}**.`,
                        flags:
                            MessageFlags.Ephemeral,
                    },
                );
            }

           if (
    subcommand === 'edit'
) {
    const id =
        interaction.options.getString(
            'id',
            true,
        );

    const responder =
        config.responders.find(
            item =>
                item.id === id,
        );

    if (!responder) {
        throw createError(
            `Autoresponder not found: ${id}`,
            ErrorTypes.NOT_FOUND,
            '❌ Không tìm thấy autoresponder này.',
        );
    }

    const session =
        createBuilderSession({
            userId:
                interaction.user.id,
            guildId,
            mode: 'edit',
            responderId:
                responder.id,
            keyword:
                responder.displayKeyword ||
                responder.keyword,
            type:
                responder.type,
            response:
                responder.response,
        });

    await interaction.deferReply({
        flags:
            MessageFlags.Ephemeral |
            MessageFlags.IsComponentsV2,
    });

    const {
        sendBuilder,
    } = await import(
        '../../interactions/modals/autoresponder/autoresponder.js'
    );

    await sendBuilder(
        interaction,
        session,
    );

    return;
}
        },
        {
            type: 'command',
            commandName:
                'autoresponder',
        },
    ),

    async autocomplete(
        interaction,
        client,
    ) {
        const config =
            await getAutoresponderConfig(
                client,
                interaction.guildId,
            );

        const focused =
            interaction.options.getFocused();

        const results =
            (config.responders || [])
                .filter(responder =>
                    (
                        responder.displayKeyword ||
                        responder.keyword
                    )
                        .toLowerCase()
                        .includes(
                            focused.toLowerCase(),
                        ),
                )
                .slice(0, 25)
                .map(responder => ({
                    name:
                        `${responder.displayKeyword || responder.keyword} — ${responder.type}`,
                    value:
                        responder.id,
                }));

        await interaction.respond(
            results,
        );
    },
};

function buildInitialModal(
    sessionId,
    keyword,
) {
    return new ModalBuilder()
        .setCustomId(
            `autoresponder_initial:${sessionId}`,
        )
        .setTitle(
            'Autoresponder',
        )
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(
                        'response_title',
                    )
                    .setLabel(
                        'Tiêu đề (Title - có thể để trống)',
                    )
                    .setStyle(
                        TextInputStyle.Short,
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        'Nhập tiêu đề phản hồi (tùy chọn)...',
                    )
                    .setMaxLength(256),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(
                        'response_content',
                    )
                    .setLabel(
                        'Nội dung trả lời',
                    )
                    .setStyle(
                        TextInputStyle.Paragraph,
                    )
                    .setRequired(true)
                    .setPlaceholder(
                        'Nhập nội dung bot sẽ trả lời...',
                    )
                    .setMaxLength(4000),
            ),
        );
}
