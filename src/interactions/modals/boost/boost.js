import {
    MessageFlags,
} from 'discord.js';

import {
    setBoostConfig,
} from '../../../services/boost/boostService.js';


export default async function handleBoostModal(
    interaction,
) {
    if (
        !interaction.isModalSubmit()
    ) {
        return false;
    }


    if (
        !interaction.customId.startsWith(
            'boost_modal:',
        )
    ) {
        return false;
    }


    const action =
        interaction.customId.split(
            ':',
        )[1];


    // ========================================================
    // EMBED
    // ========================================================

    if (
        action === 'embed'
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
                    title || '🌸 Server Boosted!',

                description:
                    description ||
                    '{member} vừa **Boost Server**!',

                color:
                    color || '#F5A9C6',

                footer:
                    footer || '{server}',
            },
        );


        await interaction.reply({
            content:
                '✅ Đã lưu giao diện Boost Embed.',

            flags:
                MessageFlags.Ephemeral,
        });

        return true;
    }


    // ========================================================
    // IMAGE
    // ========================================================

    if (
        action === 'image'
    ) {
        const image =
            interaction.fields.getTextInputValue(
                'image',
            );


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

        return true;
    }


    // ========================================================
    // SETTINGS
    // ========================================================

    if (
        action === 'settings'
    ) {
        const channelId =
            interaction.fields.getTextInputValue(
                'channelId',
            );

        const tyPhuRoleId =
            interaction.fields.getTextInputValue(
                'tyPhuRoleId',
            );


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

        return true;
    }


    return false;
}
