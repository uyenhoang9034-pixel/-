import {
    MessageFlags,
} from 'discord.js';

import {
    setBoostConfig,
    DEFAULT_TITLE,
    DEFAULT_DESCRIPTION,
} from '../../../services/boost/boostService.js';


// ============================================================
// EMBED MODAL
// ============================================================

async function handleBoostEmbedModal(
    interaction,
) {
    const title =
        interaction.fields.getTextInputValue(
            'title',
        );


    const description =
        interaction.fields.getTextInputValue(
            'description',
        );


    const color =
        interaction.fields.getTextInputValue(
            'color',
        );


    const footer =
        interaction.fields.getTextInputValue(
            'footer',
        );


    await setBoostConfig(
        interaction.guild.id,
        {
            title:
                title ||
                DEFAULT_TITLE,

            description:
                description ||
                DEFAULT_DESCRIPTION,

            color:
                color ||
                '#F5A9C6',

            footer:
                footer ||
                '{server}',
        },
    );


    await interaction.reply({
        content:
            '✅ Đã lưu giao diện Boost Embed.',

        flags:
            MessageFlags.Ephemeral,
    });
}


// ============================================================
// SETTINGS MODAL
// ============================================================

async function handleBoostSettingsModal(
    interaction,
) {
    const channelId =
        interaction.fields.getTextInputValue(
            'channelId',
        ).trim();


    const tyPhuRoleId =
        interaction.fields.getTextInputValue(
            'tyPhuRoleId',
        ).trim();


    await setBoostConfig(
        interaction.guild.id,
        {
            channelId:
                channelId ||
                null,

            tyPhuRoleId:
                tyPhuRoleId ||
                null,
        },
    );


    await interaction.reply({
        content:
            '✅ Đã lưu Boost Settings.',

        flags:
            MessageFlags.Ephemeral,
    });
}


// ============================================================
// EXPORT
// ============================================================

export default [
    {
        name:
            'boost_modal',

        execute: async (
            interaction,
            client,
            args = [],
        ) => {
            const action =
                args[0] ||
                interaction.customId.split(
                    ':',
                )[1];


            if (
                action ===
                'embed'
            ) {
                return handleBoostEmbedModal(
                    interaction,
                );
            }


            if (
                action ===
                'settings'
            ) {
                return handleBoostSettingsModal(
                    interaction,
                );
            }
        },
    },
];
