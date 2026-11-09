import {
    SlashCommandBuilder,
    MessageFlags,
} from 'discord.js';

import {
    TitanBotError,
    ErrorTypes,
} from '../../utils/errorHandler.js';
import {
    isInGuildInteraction,
    assertGiveawayCommandAdmin,
} from '../../utils/giveawayPermissions.js';

import giveawayDashboard from './modules/giveaway_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('gdashboard')
        .setDescription('Open the giveaway dashboard.')
        .setDMPermission(false),

    async execute(interaction) {
        if (!isInGuildInteraction(interaction)) {
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
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });
        }

        /*
         * Check permission after acknowledgement.
         * Because the interaction is already deferred,
         * the existing error handler can safely editReply.
         */
        await assertGiveawayCommandAdmin(
            interaction,
            'mở bảng điều khiển giveaway',
        );

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
        return await giveawayDashboard.execute(
            interaction,
            null,
            interaction.client,
        );
    },
};
