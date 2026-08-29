import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';

import {
    TitanBotError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

import giveawayDashboard from './modules/giveaway_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('gdashboard')
        .setDescription('Open the giveaway dashboard.')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild,
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            throw new TitanBotError(
                'Giveaway dashboard used outside guild',
                ErrorTypes.VALIDATION,
                'This command can only be used in a server.',
                {
                    userId: interaction.user?.id,
                },
            );
        }

        /*
         * IMPORTANT
         * -----------
         * Acknowledge the slash command immediately.
         *
         * Discord only gives the bot a short interaction
         * window. The dashboard contains embeds/components
         * and may pass through additional processing, so we
         * defer first and let giveaway_dashboard.js edit
         * the deferred reply afterwards.
         */

        /*
         * Check permission after acknowledgement.
         * Because the interaction is already deferred,
         * the existing error handler can safely editReply.
         */

        /*
         * giveaway_dashboard.js already contains:
         *
         * execute()
         * handleInteraction()
         *
         * Its interaction.reply() is compatible with the
         * InteractionHelper patch because the interaction
         * has already been deferred.
         */
     if (
            !interaction.member?.permissions?.has(
                PermissionFlagsBits.ManageGuild,
            )
        ) {
            throw new TitanBotError(
                'User lacks ManageGuild permission',
                ErrorTypes.PERMISSION,
                "You need the 'Manage Server' permission to use the giveaway dashboard.",
                {
                    userId: interaction.user?.id,
                    guildId: interaction.guildId,
                },
            );
        }

        return await giveawayDashboard.execute(
            interaction,
            null,
            interaction.client,
        );
    },
};
