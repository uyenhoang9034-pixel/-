import {
    SlashCommandBuilder,
    MessageFlags,
} from 'discord.js';

import {
    canManageAutoReact,
    getAutoReactConfig,
    addAutoReact,
    removeAutoReact,
    toggleAutoReact,
    setAutoReactEnabled,
} from '../../services/autoreact/autoreactService.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

export default {
    slashOnly: true,

    category: 'Community',

    data: new SlashCommandBuilder()
        .setName('autoreact')
        .setDescription(
            'Manage automatic emoji reactions',
        )

        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription(
                    'React to messages containing a keyword',
                )

                .addStringOption(option =>
                    option
                        .setName('keyword')
                        .setDescription(
                            'Keyword that triggers the reaction',
                        )
                        .setRequired(true)
                        .setMaxLength(100),
                )

                .addStringOption(option =>
                    option
                        .setName('emoji')
                        .setDescription(
                            'A custom emoji from this server',
                        )
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        )

        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription(
                    'Remove an auto-reaction',
                )

                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription(
                            'Auto-reaction ID',
                        )
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        )

        .addSubcommand(sub =>
            sub
                .setName('list')
                .setDescription(
                    'List all auto-reactions',
                ),
        )

        .addSubcommand(sub =>
            sub
                .setName('enable')
                .setDescription(
                    'Enable the auto-react system',
                ),
        )

        .addSubcommand(sub =>
            sub
                .setName('disable')
                .setDescription(
                    'Disable the auto-react system',
                ),
        )

        .addSubcommand(sub =>
            sub
                .setName('toggle')
                .setDescription(
                    'Enable or disable one auto-reaction',
                )

                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription(
                            'Auto-reaction ID',
                        )
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return InteractionHelper.safeReply(
                interaction,
                {
                    content:
                        '❌ Lệnh này chỉ dùng được trong server.',

                    flags:
                        MessageFlags.Ephemeral,
                },
            );
        }

        if (
            !canManageAutoReact(
                interaction.member,
            )
        ) {
            return InteractionHelper.safeReply(
                interaction,
                {
                    content:
                        '❌ Bạn cần quyền **Manage Server** để quản lý Auto React.',

                    flags:
                        MessageFlags.Ephemeral,
                },
            );
        }

        const subcommand =
            interaction.options.getSubcommand();

        const guildId =
            interaction.guildId;

        /**
         * ADD
         */
        if (
            subcommand === 'add'
        ) {
            const keyword =
                interaction.options.getString(
                    'keyword',
                    true,
                );

            const emojiInput =
                interaction.options.getString(
                    'emoji',
                    true,
                );

            const match =
                emojiInput.match(
                    /<(a?):([^:>]+):(\d+)>/,
                );

            const emojiId =
                match?.[3] ||
                emojiInput;

            const emoji =
                interaction.guild.emojis.cache.get(
                    emojiId,
                );

            if (!emoji) {
                return InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ Emoji không hợp lệ hoặc không phải emoji của server này.',

                        flags:
                            MessageFlags.Ephemeral,
                    },
                );
            }

            const result =
                await addAutoReact(
                    interaction.client,
                    guildId,
                    {
                        keyword,
                        emoji,
                    },
                );

            if (!result.success) {
                if (
                    result.reason ===
                    'duplicate_keyword'
                ) {
                    return InteractionHelper.safeReply(
                        interaction,
                        {
                            content:
                                '❌ Keyword này đã được cấu hình rồi.',

                            flags:
                                MessageFlags.Ephemeral,
                        },
                    );
                }

                return InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ Keyword không hợp lệ.',

                        flags:
                            MessageFlags.Ephemeral,
                    },
                );
            }

            return InteractionHelper.safeReply(
                interaction,
                {
                    content:
                        `🌸 Đã thêm Auto React: **${result.reaction.displayKeyword}** → ${emoji}`,

                    flags:
                        MessageFlags.Ephemeral,
                },
            );
        }

        /**
         * REMOVE
         */
        if (
            subcommand === 'remove'
        ) {
            const id =
                interaction.options.getString(
                    'id',
                    true,
                );

            const result =
                await removeAutoReact(
                    interaction.client,
                    guildId,
                    id,
                );

            if (!result.success) {
                return InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '❌ Không tìm thấy Auto React này.',

                        flags:
                            MessageFlags.Ephemeral,
                    },
                );
            }

            return InteractionHelper.safeReply(
                interaction,
                {
                    content:
                        `🗑️ Đã xóa Auto React **${result.reaction.displayKeyword}**.`,

                    flags:
                        MessageFlags.Ephemeral,
                },
            );
        }

        /**
         * LIST
         */
        if (
            subcommand === 'list'
        ) {
            const config =
                await getAutoReactConfig(
                    interaction.client,
                    guildId,
                );

            if (
                config.reactions.length === 0
            ) {
                return InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            '🌷 Server chưa có Auto React nào.',

                        flags:
                            MessageFlags.Ephemeral,
                    },
                );
            }

            const lines =
                config.reactions.map(
                    item => {
                        const emoji =
                            interaction.guild.emojis.cache.get(
                                item.emojiId,
                            );

                        return (
                            `\`${item.id}\` • ` +
                            `**${item.displayKeyword}** → ` +
                            `${emoji || `<:${item.emojiName || 'emoji'}:${item.emojiId}>`} • ` +
                            `${item.enabled ? '🟢' : '🔴'}`
                        );
                    },
                );

            return InteractionHelper.safeReply(
                interaction,
                {
                    content:
                        `🌸 **Auto React** ` +
                        `(${config.enabled ? '🟢 Enabled' : '🔴 Disabled'})\n\n` +
                        lines.join('\n'),

                    flags:
                        MessageFlags.Ephemeral,
                },
            );
        }

        /**
         * ENABLE / DISABLE
         */
        if (
            subcommand === 'enable' ||
            subcommand === 'disable'
        ) {
            const enabled =
                subcommand === 'enable';

            await setAutoReactEnabled(
                interaction.client,
                guildId,
                enabled,
            );

            return InteractionHelper.safeReply(
                interaction,
                {
                    content:
                        enabled
                            ? '🟢 Auto React đã được bật.'
                            : '🔴 Auto React đã được tắt.',

                    flags:
                        MessageFlags.Ephemeral,
                },
            );
        }

        /**
         * TOGGLE
         */
        const id =
            interaction.options.getString(
                'id',
                true,
            );

        const config =
            await getAutoReactConfig(
                interaction.client,
                guildId,
            );

        const current =
            config.reactions.find(
                item =>
                    item.id === id,
            );

        if (!current) {
            return InteractionHelper.safeReply(
                interaction,
                {
                    content:
                        '❌ Không tìm thấy Auto React này.',

                    flags:
                        MessageFlags.Ephemeral,
                },
            );
        }

        const result =
            await toggleAutoReact(
                interaction.client,
                guildId,
                id,
                !current.enabled,
            );

        return InteractionHelper.safeReply(
            interaction,
            {
                content:
                    result.reaction.enabled
                        ? '🟢 Auto React đã được bật.'
                        : '🔴 Auto React đã được tắt.',

                flags:
                    MessageFlags.Ephemeral,
            },
        );
    },

    async autocomplete(interaction) {
        const focused =
            interaction.options.getFocused(true);

        const config =
            await getAutoReactConfig(
                interaction.client,
                interaction.guildId,
            );

        /**
         * Emoji autocomplete
         */
        if (
            focused.name === 'emoji'
        ) {
            const query =
                String(
                    focused.value || '',
                ).toLowerCase();

            const choices =
                interaction.guild.emojis.cache
                    .filter(
                        emoji =>
                            !query ||
                            emoji.name
                                ?.toLowerCase()
                                .includes(query),
                    )
                    .first(25)
                    .map(
                        emoji => ({
                            name:
                                `${emoji.name || 'emoji'} • ` +
                                `${emoji.animated ? 'Animated' : 'Static'}`
                                    .slice(0, 100),

                            value:
                                emoji.toString(),
                        }),
                    );

            return interaction.respond(
                choices,
            );
        }

        /**
         * Existing Auto React autocomplete
         */
        const query =
            String(
                focused.value || '',
            ).toLowerCase();

        const choices =
            config.reactions
                .filter(
                    item =>
                        (
                            item.displayKeyword ||
                            item.keyword
                        )
                            .toLowerCase()
                            .includes(query),
                )
                .slice(0, 25)
                .map(
                    item => ({
                        name:
                            `${item.displayKeyword || item.keyword} → ` +
                            `${item.emojiName || item.emojiId}`
                                .slice(0, 100),

                        value:
                            item.id,
                    }),
                );

        return interaction.respond(
            choices,
        );
    },
};
