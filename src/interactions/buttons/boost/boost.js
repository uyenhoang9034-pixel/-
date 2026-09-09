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
// BOOST DASHBOARD BUTTON HANDLER
// ============================================================

async function handleBoostButton(
    interaction,
    client,
    args = [],
) {
    const action =
        args[0] ||
        interaction.customId.split(
            ':',
        )[1];


    // ========================================================
    // EDIT EMBED
    // ========================================================

    if (
        action ===
        'embed'
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
                    config.title ||
                    '',
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
                    config.description ||
                    '',
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
                    config.color ||
                    '#F5A9C6',
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
                    config.footer ||
                    '',
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
    // SETTINGS
    // ========================================================

    if (
        action ===
        'settings'
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
                    config.channelId ||
                    '',
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
                    config.tyPhuRoleId ||
                    '',
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
    // TEST
    // ========================================================

    if (
        action ===
        'test'
    ) {
        const result =
            await sendTestBoost(
                interaction.member,
            );


        const errorText = {
            CHANNEL_NOT_CONFIGURED:
                'Boost Channel chưa được cài.',

            CHANNEL_NOT_FOUND:
                'Không tìm thấy Boost Channel.',

            CHANNEL_NOT_TEXT:
                'Boost Channel không phải kênh text.',

            BOOST_IMAGE_NOT_FOUND:
                'Không tìm thấy file `assets/boost/boost.webp`.',

            SEND_FAILED:
                'Không gửi được thông báo lên Discord.',
        }[
            result.reason
        ];


        await interaction.reply({
            content:
                result.success
                    ? '✅ Test Boost đã được gửi.'
                    : `❌ Không thể gửi Test Boost.\nLỗi: **${
                        errorText ||
                        result.reason ||
                        'UNKNOWN'
                    }**`,

            flags:
                MessageFlags.Ephemeral,
        });


        return;
    }
}


// ============================================================
// EXPORT
// ============================================================

export default {
    name:
        'boost_dashboard',

    execute:
        handleBoostButton,
};
