import {
    MessageFlags,
} from 'discord.js';

import {
    setBoostConfig,
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
                '🌸 Server Boosted!',

            description:
                description ||
                '{member} vừa **Boost Server**!\n\n' +
                '👑 **TỶ PHÚ** đã được trao cho {member}.',

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
// IMAGE MODAL
// ============================================================

async function handleBoostImageModal(
    interaction,
) {
    const image =
        interaction.fields.getTextInputValue(
            'image',
        ).trim();


    await setBoostConfig(
        interaction.guild.id,
        {
            image:
                image || null,
        },
    );


    await interaction.reply({
        content:
            image
                ? '✅ Đã thay Boost Image.'
                : '✅ Đã xoá Boost Image.',

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
                channelId || null,

            tyPhuRoleId:
                tyPhuRoleId || null,
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
        name: 'boost_modal',

        execute: async (
            interaction,
            client,
            args = [],
        ) => {
            const action =
                args[0] ||
                interaction.customId.split(':')[1];


            if (
                action === 'embed'
            ) {
                return handleBoostEmbedModal(
                    interaction,
                );
            }


            if (
                action === 'image'
            ) {
                return handleBoostImageModal(
                    interaction,
                );
            }


            if (
                action === 'settings'
            ) {
                return handleBoostSettingsModal(
                    interaction,
                );
            }
        },
    },
];
