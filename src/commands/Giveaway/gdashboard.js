import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import giveawayDashboard from './modules/giveaway_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('gdashboard')
        .setDescription('Open the giveaway dashboard.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            throw new TitanBotError(
                'Giveaway dashboard used outside guild',
                ErrorTypes.VALIDATION,
                'This command can only be used in a server.',
                {
                    userId: interaction.user.id,
                },
            );
        }

        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.ManageGuild,
            )
        ) {
            throw new TitanBotError(
                'User lacks ManageGuild permission',
                ErrorTypes.PERMISSION,
                "You need the 'Manage Server' permission to use the giveaway dashboard.",
                {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                },
            );
        }

        return giveawayDashboard.execute(
            interaction,
            null,
            interaction.client,
        );
    },
};
