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

        if (!hasRoleTier(interaction.member, 'TOP_ADMIN', interaction.guild, interaction.user)) {
            return interaction.reply({
                content: `❌ ${buildRoleDeniedMessage('channelguide')}`,
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
