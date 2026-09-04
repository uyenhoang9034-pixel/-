import {
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} from 'discord.js';

import {
    getBoostConfig,
    sendTestBoost,
} from '../../../services/boost/boostService.js';


async function handleBoostButton(
    interaction,
) {
    const action =
        interaction.customId.split(':')[1];


    // ========================================================
    // EDIT EMBED
    // ========================================================

    if (
        action === 'embed'
    ) {
        const config =
            await getBoostConfig(
                interaction.guild.id,
            );


        const modal =
            new ModalBuilder()
                .setCustomId(
                    'boost_modal:embed',
                )
                .setTitle(
                    'Edit Boost Embed',
                );


        const titleInput =
            new TextInputBuilder()
                .setCustomId(
                    'title',
                )
                .setLabel(
                    'Embed Title',
                )
                .setStyle(
                    TextInputStyle.Short,
                )
                .setRequired(
                    false,
                )
                .setValue(
                    config.title || '',
                );


        const descriptionInput =
            new TextInputBuilder()
                .setCustomId(
                    'description',
                )
                .setLabel(
                    'Embed Description',
                )
                .setStyle(
                    TextInputStyle.Paragraph,
                )
                .setRequired(
                    false,
                )
                .setValue(
                    config.description || '',
                );


        const colorInput =
            new TextInputBuilder()
                .setCustomId(
                    'color',
                )
                .setLabel(
                    'Embed Color',
                )
                .setStyle(
                    TextInputStyle.Short,
                )
                .setRequired(
                    false,
                )
                .setValue(
                    config.color || '#F5A9C6',
                );


        const footerInput =
            new TextInputBuilder()
                .setCustomId(
                    'footer',
                )
                .setLabel(
                    'Footer',
                )
                .setStyle(
                    TextInputStyle.Short,
                )
                .setRequired(
                    false,
                )
                .setValue(
                    config.footer || '',
                );


        modal.addComponents(
            new ActionRowBuilder()
                .addComponents(
                    titleInput,
                ),

            new ActionRowBuilder()
                .addComponents(
                    descriptionInput,
                ),

            new ActionRowBuilder()
                .addComponents(
                    colorInput,
                ),

            new ActionRowBuilder()
                .addComponents(
                    footerInput,
                ),
        );


        await interaction.showModal(
            modal,
        );

        return;
    }


    // ========================================================
    // IMAGE
    // ========================================================

    if (
        action === 'image'
    ) {
        const config =
            await getBoostConfig(
                interaction.guild.id,
            );


        const modal =
            new ModalBuilder()
                .setCustomId(
                    'boost_modal:image',
                )
                .setTitle(
                    'Boost Image',
                );


        const imageInput =
            new TextInputBuilder()
                .setCustomId(
                    'image',
                )
                .setLabel(
                    'Image URL',
                )
                .setStyle(
                    TextInputStyle.Short,
                )
                .setRequired(
                    false,
                )
                .setValue(
                    config.image || '',
                );


        modal.addComponents(
            new ActionRowBuilder()
                .addComponents(
                    imageInput,
                ),
        );


        await interaction.showModal(
            modal,
        );

        return;
    }


    // ========================================================
    // SETTINGS
    // ========================================================

    if (
        action === 'settings'
    ) {
        const config =
            await getBoostConfig(
                interaction.guild.id,
            );


        const modal =
            new ModalBuilder()
                .setCustomId(
                    'boost_modal:settings',
                )
                .setTitle(
                    'Boost Settings',
                );


        const channelInput =
            new TextInputBuilder()
                .setCustomId(
                    'channelId',
                )
                .setLabel(
                    'Boost Channel ID',
                )
                .setStyle(
                    TextInputStyle.Short,
                )
                .setRequired(
                    false,
                )
                .setValue(
                    config.channelId || '',
                );


        const roleInput =
            new TextInputBuilder()
                .setCustomId(
                    'tyPhuRoleId',
                )
                .setLabel(
                    'TỶ PHÚ Role ID',
                )
                .setStyle(
                    TextInputStyle.Short,
                )
                .setRequired(
                    false,
                )
                .setValue(
                    config.tyPhuRoleId || '',
                );


        modal.addComponents(
            new ActionRowBuilder()
                .addComponents(
                    channelInput,
                ),

            new ActionRowBuilder()
                .addComponents(
                    roleInput,
                ),
        );


        await interaction.showModal(
            modal,
        );

        return;
    }


    // ========================================================
    // TEST BOOST
    // ========================================================

    if (
        action === 'test'
    ) {
        const result =
            await sendTestBoost(
                interaction.member,
            );


        await interaction.reply({
            content:
                result.success
                    ? '✅ Test Boost đã được gửi.'
                    : '❌ Không thể gửi Test Boost. Hãy kiểm tra Boost Channel.',

            flags:
                MessageFlags.Ephemeral,
        });

        return;
    }
}


// ============================================================
// EXPORT INTERACTIONS
// ============================================================

export default [
    {
        name: 'boost_dashboard:embed',

        execute: handleBoostButton,
    },

    {
        name: 'boost_dashboard:image',

        execute: handleBoostButton,
    },

    {
        name: 'boost_dashboard:settings',

        execute: handleBoostButton,
    },

    {
        name: 'boost_dashboard:test',

        execute: handleBoostButton,
    },
];
