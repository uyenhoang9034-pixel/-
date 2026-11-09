import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { hasRoleTier, buildRoleDeniedMessage } from '../../config/commands/roleAccess.js';
import greetDashboard from './modules/greet_dashboard.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('greet')
        .setDescription('Manage welcome & goodbye settings')
        .setDefaultMemberPermissions(0n)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('Open the welcome & goodbye configuration dashboard'),
        ),

    async execute(interaction, config, client) {
        try {
            if (!hasRoleTier(interaction.member, 'MID_ADMIN', interaction.guild, interaction.user)) {
                return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: buildRoleDeniedMessage('greet') });
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'dashboard':
                    return await greetDashboard.execute(interaction, config, client);
                default:
                    logger.warn(`Unknown /greet subcommand: ${subcommand}`);
            }
        } catch (error) {
            if (error instanceof TitanBotError) {
                return await replyUserError(interaction, { type: ErrorTypes.CONFIGURATION, message: error.userMessage || 'Something went wrong.' });
            }
            await handleInteractionError(interaction, error, { command: 'greet' });
        }
    },
};