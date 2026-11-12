import {
    SlashCommandBuilder,
    MessageFlags,
} from 'discord.js';
import { hasRoleTier, buildRoleDeniedMessage } from '../../config/commands/roleAccess.js';

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('channelguide')
        .setDescription('Manage the server Channel Guide')
        .setDefaultMemberPermissions(0n)
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Open the Channel Guide Dashboard (Panel 1)'),
        )
        .addSubcommand(sub =>
            sub
                .setName('setup2')
                .setDescription('Open the Channel Guide 2 Dashboard (Panel 2)'),
        ),

    category: 'Community',

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: '❌ Lệnh này chỉ dùng trong server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (!hasRoleTier(interaction.member, 'TOP_ADMIN', interaction.guild, interaction.user)) {
            return interaction.reply({
                content: `❌ ${buildRoleDeniedMessage('channelguide')}`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const subcommand = interaction.options?.getSubcommand?.(false) || 'setup';
        const panelSlot = subcommand === 'setup2' ? 2 : 1;

        const { showChannelGuideDashboard } = await import(
            './modules/channelguide_dashboard.js'
        );

        await showChannelGuideDashboard(
            interaction,
            interaction.client,
            null,
            { panelSlot },
        );
    },
};
