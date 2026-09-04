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


// ============================================================
// BOOST DASHBOARD BUTTONS
// ============================================================

export const boostEmbedButton = {
    customId: 'boost_dashboard:embed',

    async execute(interaction) {
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
    },
};


// ============================================================
// IMAGE BUTTON
// ============================================================

export const boostImageButton = {
    customId: 'boost_dashboard:image',

    async execute(interaction) {
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
    },
};


// ============================================================
// SETTINGS BUTTON
// ============================================================

export const boostSettingsButton = {
    customId: 'boost_dashboard:settings',

    async execute(interaction) {
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
    },
};


// ============================================================
// TEST BOOST BUTTON
// ============================================================

export const boostTestButton = {
    customId: 'boost_dashboard:test',

    async execute(interaction) {
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
    },
};


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default [
    boostEmbedButton,
    boostImageButton,
    boostSettingsButton,
    boostTestButton,
];
