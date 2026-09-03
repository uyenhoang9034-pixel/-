import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('channelguide')
        .setDescription('Manage the server Channel Guide')
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Open the Channel Guide Dashboard'),
        ),

    category: 'Community',

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: '❌ Lệnh này chỉ dùng trong server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const hasPermission =
            interaction.member.permissions.has(
                PermissionFlagsBits.Administrator,
            ) ||
            interaction.member.permissions.has(
                PermissionFlagsBits.ManageGuild,
            );

        if (!hasPermission) {
            return interaction.reply({
                content:
                    '❌ Bạn cần quyền Administrator hoặc Manage Server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const { showChannelGuideDashboard } = await import(
            './modules/channelguide_dashboard.js'
        );

        await showChannelGuideDashboard(
            interaction,
            interaction.client,
        );
    },
};
