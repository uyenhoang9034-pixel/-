import {
    MessageFlags,
} from 'discord.js';

import {
    setBoostConfig,
} from '../../../services/boost/boostService.js';


// ============================================================
// DEFAULT EMBED CONTENT
// ============================================================

const DEFAULT_TITLE =
    '𝓝𝓰𝓾̛𝓸̛̀𝓲 𝓰𝓲𝓪̀𝓾 𝓽𝓸̛́𝓲 𝓬𝓱𝓸̛𝓲 ≽^- ˕ -^≼';

const DEFAULT_DESCRIPTION =
    '<a:trangtrig27:1546093546178748426> Xĩe xĩe đại gia {member} đã boost cho server!\n' +
    '<a:trangtrig14:1546047912969113622> {member} trực tiếp thăng cấp lên role <@&1541305195512856627> của server và nhận được những đãi ngộ độc quyền!\n\n\n' +
    '⋆.ೃ࿔🌸*:･\n' +
    '<a:heartg2:1546031808364413019> **Boost hiện tại:** {boosts}\n' +
    '<a:heartg2:1546031808364413019> **Boost Level:** {boostLevel}';


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
