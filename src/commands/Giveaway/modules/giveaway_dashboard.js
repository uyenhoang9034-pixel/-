import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    MessageFlags,
} from 'discord.js';

import {
    parseDuration,
    validatePrize,
    validateWinnerCount,
    createGiveawayEmbed,
    createGiveawayButtons,
} from '../../../services/giveawayService.js';

import { saveGiveaway } from '../../../utils/giveaways.js';
import { botConfig } from '../../../config/bot.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

const DEFAULTS = {
    title: '🎉 Giveaway',
    description: 'React with the button below to enter!',
    color: '#5865F2',
    imageUrl: '',
    prize: '',
    duration: '1h',
    winners: 1,
    channelId: null,
};

const sessions = new Map();

function getSessionKey(interaction) {
    return `${interaction.guildId}:${interaction.user.id}`;
}

function getSession(interaction) {
    const key = getSessionKey(interaction);

    if (!sessions.has(key)) {
        sessions.set(key, {
            ...DEFAULTS,
        });
    }

    return sessions.get(key);
}

function resetSession(interaction) {
    sessions.set(getSessionKey(interaction), {
        ...DEFAULTS,
    });

    return sessions.get(getSessionKey(interaction));
}

function cleanupSession(interaction) {
    sessions.delete(getSessionKey(interaction));
}

function normalizeHexColor(value) {
    if (!value) {
        return DEFAULTS.color;
    }

    const color = value.trim();

    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return color;
    }

    if (/^[0-9A-Fa-f]{6}$/.test(color)) {
        return `#${color}`;
    }

    return DEFAULTS.color;
}

function buildDashboardEmbed(interaction, session) {
    const channelText = session.channelId
        ? `<#${session.channelId}>`
        : 'Current channel';

    const prizeText = session.prize || 'Not set';
    const titleText = session.title || 'Not set';
    const descriptionText = session.description || 'Not set';
    const imageText = session.imageUrl || 'Not set';

    return new EmbedBuilder()
        .setColor(normalizeHexColor(session.color))
        .setTitle('🎁 Giveaway Dashboard')
        .setDescription(
            'Configure your giveaway and create it when everything is ready.',
        )
        .addFields(
            {
                name: '🎁 Prize',
                value: prizeText.substring(0, 1024),
                inline: false,
            },
            {
                name: '✨ Title',
                value: titleText.substring(0, 1024),
                inline: true,
            },
            {
                name: '⏱️ Duration',
                value: session.duration || 'Not set',
                inline: true,
            },
            {
                name: '🏆 Winners',
                value: String(session.winners || 1),
                inline: true,
            },
            {
                name: '📍 Channel',
                value: channelText,
                inline: true,
            },
            {
                name: '🎨 Color',
                value: normalizeHexColor(session.color),
                inline: true,
            },
            {
                name: '🖼️ Image',
                value: imageText.substring(0, 1024),
                inline: false,
            },
            {
                name: '📝 Description',
                value: descriptionText.substring(0, 1024),
                inline: false,
            },
        )
        .setFooter({
            text: `Requested by ${interaction.user.tag}`,
        });
}

function buildSelectMenu() {
    return new StringSelectMenuBuilder()
        .setCustomId('giveaway_dashboard_select')
        .setPlaceholder('Configure giveaway...')
        .addOptions(
            {
                label: 'Prize',
                description: 'Set the giveaway prize.',
                value: 'prize',
                emoji: '🎁',
            },
            {
                label: 'Duration',
                description: 'Set giveaway duration.',
                value: 'duration',
                emoji: '⏱️',
            },
            {
                label: 'Winners',
                description: 'Set the number of winners.',
                value: 'winners',
                emoji: '🏆',
            },
            {
                label: 'Title',
                description: 'Set the giveaway title.',
                value: 'title',
                emoji: '✨',
            },
            {
                label: 'Description',
                description: 'Set the giveaway description.',
                value: 'description',
                emoji: '📝',
            },
            {
                label: 'Color',
                description: 'Set the embed color.',
                value: 'color',
                emoji: '🎨',
            },
            {
                label: 'Image',
                description: 'Set the giveaway image.',
                value: 'image',
                emoji: '🖼️',
            },
            {
                label: 'Channel',
                description: 'Choose where to send the giveaway.',
                value: 'channel',
                emoji: '📍',
            },
            {
                label: 'Reset',
                description: 'Reset all giveaway settings.',
                value: 'reset',
                emoji: '🔄',
            },
        );
}

function buildDashboardComponents() {
    return [
        new ActionRowBuilder().addComponents(buildSelectMenu()),

        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_dashboard_create')
                .setLabel('Create Giveaway')
                .setEmoji('🎉')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId('giveaway_dashboard_cancel')
                .setLabel('Cancel')
                .setEmoji('✖️')
                .setStyle(ButtonStyle.Secondary),
        ),
    ];
}

function buildModal(type, session) {
    const modal = new ModalBuilder();

    if (type === 'prize') {
        modal
            .setCustomId('giveaway_modal_prize')
            .setTitle('Set Giveaway Prize');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('prize')
                    .setLabel('Prize')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Example: 1000 Coins')
                    .setValue(session.prize || '')
                    .setRequired(true)
                    .setMaxLength(256),
            ),
        );
    }

    if (type === 'duration') {
        modal
            .setCustomId('giveaway_modal_duration')
            .setTitle('Set Giveaway Duration');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('duration')
                    .setLabel('Duration')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Examples: 30m, 1h, 2d')
                    .setValue(session.duration || '1h')
                    .setRequired(true)
                    .setMaxLength(10),
            ),
        );
    }

    if (type === 'winners') {
        modal
            .setCustomId('giveaway_modal_winners')
            .setTitle('Set Winner Count');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('winners')
                    .setLabel('Number of winners')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Example: 5')
                    .setValue(String(session.winners || 1))
                    .setRequired(true)
                    .setMaxLength(2),
            ),
        );
    }

    if (type === 'title') {
        modal
            .setCustomId('giveaway_modal_title')
            .setTitle('Set Giveaway Title');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Title')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Example: ✨ Special Giveaway')
                    .setValue(session.title || '')
                    .setRequired(true)
                    .setMaxLength(256),
            ),
        );
    }

    if (type === 'description') {
        modal
            .setCustomId('giveaway_modal_description')
            .setTitle('Set Giveaway Description');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('description')
                    .setLabel('Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Write the giveaway description...')
                    .setValue(session.description || '')
                    .setRequired(true)
                    .setMaxLength(4000),
            ),
        );
    }

    if (type === 'color') {
        modal
            .setCustomId('giveaway_modal_color')
            .setTitle('Set Embed Color');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('color')
                    .setLabel('HEX Color')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#FF69B4')
                    .setValue(session.color || DEFAULTS.color)
                    .setRequired(true)
                    .setMaxLength(7),
            ),
        );
    }

    if (type === 'image') {
        modal
            .setCustomId('giveaway_modal_image')
            .setTitle('Set Giveaway Image');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('imageUrl')
                    .setLabel('Image URL')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://example.com/image.png')
                    .setValue(session.imageUrl || '')
                    .setRequired(false)
                    .setMaxLength(1000),
            ),
        );
    }

    return modal;
}

async function showDashboard(interaction) {
    const session = getSession(interaction);

    const payload = {
        embeds: [buildDashboardEmbed(interaction, session)],
        components: buildDashboardComponents(),
        flags: MessageFlags.Ephemeral,
    };

    if (interaction.deferred || interaction.replied) {
        return InteractionHelper.safeEditReply(interaction, payload);
    }

    return InteractionHelper.safeReply(interaction, payload);
}

async function handleSelect(interaction) {
    const value = interaction.values?.[0];
    const session = getSession(interaction);

    if (value === 'reset') {
        resetSession(interaction);

        return interaction.update({
            embeds: [
                buildDashboardEmbed(
                    interaction,
                    getSession(interaction),
                ),
            ],
            components: buildDashboardComponents(),
        });
    }

    if (value === 'channel') {
        const channelMenu = new ChannelSelectMenuBuilder()
            .setCustomId('giveaway_dashboard_channel')
            .setPlaceholder('Select a channel...')
            .addChannelTypes(ChannelType.GuildText);

        const rows = [
            new ActionRowBuilder().addComponents(channelMenu),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_dashboard_back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary),
            ),
        ];

        return interaction.update({
            embeds: [buildDashboardEmbed(interaction, session)],
            components: rows,
        });
    }

    return interaction.showModal(buildModal(value, session));
}

async function handleChannelSelect(interaction) {
    const session = getSession(interaction);

    session.channelId = interaction.values?.[0] || null;

    return interaction.update({
        embeds: [buildDashboardEmbed(interaction, session)],
        components: buildDashboardComponents(),
    });
}

async function handleModal(interaction) {
    const session = getSession(interaction);

    const customId = interaction.customId;

    if (customId === 'giveaway_modal_prize') {
        const prize = interaction.fields.getTextInputValue('prize');

        session.prize = validatePrize(prize);
    }

    if (customId === 'giveaway_modal_duration') {
        const duration = interaction.fields
            .getTextInputValue('duration')
            .trim();

        parseDuration(duration);
        session.duration = duration;
    }

    if (customId === 'giveaway_modal_winners') {
        const raw = interaction.fields
            .getTextInputValue('winners')
            .trim();

        const winners = Number.parseInt(raw, 10);

        validateWinnerCount(winners);

        session.winners = winners;
    }

    if (customId === 'giveaway_modal_title') {
        session.title = interaction.fields
            .getTextInputValue('title')
            .trim();
    }

    if (customId === 'giveaway_modal_description') {
        session.description = interaction.fields
            .getTextInputValue('description')
            .trim();
    }

    if (customId === 'giveaway_modal_color') {
        const color = interaction.fields
            .getTextInputValue('color')
            .trim();

        if (!/^#?[0-9A-Fa-f]{6}$/.test(color)) {
            return interaction.reply({
                content: 'Invalid HEX color. Use a format such as #FF69B4.',
                flags: MessageFlags.Ephemeral,
            });
        }

        session.color = normalizeHexColor(color);
    }

    if (customId === 'giveaway_modal_image') {
        const imageUrl = interaction.fields
            .getTextInputValue('imageUrl')
            .trim();

        if (
            imageUrl &&
            !/^https?:\/\/.+/i.test(imageUrl)
        ) {
            return interaction.reply({
                content: 'Invalid image URL. Please provide a valid HTTP or HTTPS URL.',
                flags: MessageFlags.Ephemeral,
            });
        }

        session.imageUrl = imageUrl;
    }

    return interaction.update({
        embeds: [buildDashboardEmbed(interaction, session)],
        components: buildDashboardComponents(),
    });
}

async function createGiveaway(interaction) {
    const session = getSession(interaction);

    if (!session.prize) {
        return interaction.reply({
            content: 'Please set a prize before creating the giveaway.',
            flags: MessageFlags.Ephemeral,
        });
    }

    if (!session.duration) {
        return interaction.reply({
            content: 'Please set a duration before creating the giveaway.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const durationMs = parseDuration(session.duration);

    validateWinnerCount(session.winners);
    validatePrize(session.prize);

    const targetChannel =
        session.channelId
            ? await interaction.guild.channels
                  .fetch(session.channelId)
                  .catch(() => null)
            : interaction.channel;

    if (!targetChannel || !targetChannel.isTextBased()) {
        return interaction.reply({
            content: 'The selected channel is not available.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const endTime = Date.now() + durationMs;

    const giveawayData = {
        messageId: 'placeholder',
        channelId: targetChannel.id,
        guildId: interaction.guildId,

        prize: session.prize,

        title: session.title || DEFAULTS.title,
        description:
            session.description || DEFAULTS.description,

        color: normalizeHexColor(session.color),
        imageUrl: session.imageUrl || null,

        hostId: interaction.user.id,

        endTime,
        endsAt: endTime,

        winnerCount: session.winners,

        participants: [],

        isEnded: false,
        ended: false,

        createdAt: new Date().toISOString(),
    };

    const embed = createGiveawayEmbed(
        giveawayData,
        'active',
    );

    const buttons = createGiveawayButtons(false);

    const message = await targetChannel.send({
        content: '🎉 **NEW GIVEAWAY** 🎉',
        embeds: [embed],
        components: [buttons],
    });

    giveawayData.messageId = message.id;

    const saved = await saveGiveaway(
        interaction.client,
        interaction.guildId,
        giveawayData,
    );

    if (!saved) {
        logger.warn(
            `Giveaway message ${message.id} was created but database save failed.`,
        );
    }

    cleanupSession(interaction);

    return interaction.update({
        embeds: [
            new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('🎉 Giveaway Created')
                .setDescription(
                    `The giveaway for **${session.prize}** has been created in ${targetChannel}.`,
                )
                .addFields(
                    {
                        name: 'Duration',
                        value: session.duration,
                        inline: true,
                    },
                    {
                        name: 'Winners',
                        value: String(session.winners),
                        inline: true,
                    },
                    {
                        name: 'Channel',
                        value: targetChannel.toString(),
                        inline: true,
                    },
                ),
        ],
        components: [],
    });
}

export default {
    async execute(interaction) {
        getSession(interaction);

        return showDashboard(interaction);
    },

    async handleInteraction(interaction) {
        if (!interaction.inGuild()) {
            return false;
        }

        const customId = interaction.customId || '';

        try {
            if (
                customId ===
                'giveaway_dashboard_select'
            ) {
                await handleSelect(interaction);
                return true;
            }

            if (
                customId ===
                'giveaway_dashboard_channel'
            ) {
                await handleChannelSelect(interaction);
                return true;
            }

            if (
                customId.startsWith(
                    'giveaway_modal_',
                )
            ) {
                await handleModal(interaction);
                return true;
            }

            if (
                customId ===
                'giveaway_dashboard_create'
            ) {
                await createGiveaway(interaction);
                return true;
            }

            if (
                customId ===
                'giveaway_dashboard_cancel'
            ) {
                cleanupSession(interaction);

                await interaction.update({
                    content: 'Giveaway dashboard closed.',
                    embeds: [],
                    components: [],
                });

                return true;
            }

            if (
                customId ===
                'giveaway_dashboard_back'
            ) {
                await interaction.update({
                    embeds: [
                        buildDashboardEmbed(
                            interaction,
                            getSession(interaction),
                        ),
                    ],
                    components:
                        buildDashboardComponents(),
                });

                return true;
            }
        } catch (error) {
            logger.error(
                'Giveaway dashboard interaction error:',
                error,
            );

            const message =
                error?.userMessage ||
                error?.message ||
                'An error occurred while processing the giveaway dashboard.';

            if (
                interaction.deferred ||
                interaction.replied
            ) {
                await interaction
                    .followUp({
                        content: message,
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            } else {
                await interaction
                    .reply({
                        content: message,
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            }

            return true;
        }

        return false;
    },
};
