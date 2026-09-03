import {
    MessageFlags,
} from 'discord.js';

export default [
    {
        name:
            'autoresponder_action',

        async execute(
            interaction,
            client,
            args,
        ) {
            if (
                interaction.replied ||
                interaction.deferred
            ) {
                return;
            }

            await interaction.reply({
                content:
                    '🌸 Button này chưa được cấu hình hành động.',
                flags:
                    MessageFlags.Ephemeral,
            });
        },
    },
];
