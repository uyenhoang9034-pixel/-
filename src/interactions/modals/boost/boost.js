import {
    MessageFlags,
} from 'discord.js';

import {
    setBoostConfig,
} from '../../../services/boost/boostService.js';


// ============================================================
// EDIT EMBED MODAL
// ============================================================

export const boostEmbedModal = {
    customId: 'boost_modal:embed',

    async execute(interaction) {
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
                    '{member} vừa **Boost Server**!',

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
    },
};


// ============================================================
// IMAGE MODAL
// ============================================================

export const boostImageModal = {
    customId: 'boost_modal:image',

    async execute(interaction) {
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
    },
};


// ============================================================
// SETTINGS MODAL
// ============================================================

export const boostSettingsModal = {
    customId: 'boost_modal:settings',

    async execute(interaction) {
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
    },
};


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default [
    boostEmbedModal,
    boostImageModal,
    boostSettingsModal,
];
