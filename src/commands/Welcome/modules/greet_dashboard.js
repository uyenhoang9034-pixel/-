import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
    LabelBuilder,
    FileUploadBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';
import { getWelcomeConfig, saveWelcomeConfig } from '../../../utils/database.js';
import { botHasPermission } from '../../../utils/permissionGuard.js';

async function deferComponent(interaction) {
    if (interaction.deferred || interaction.replied) {
        return true;
    }

    try {
        await interaction.deferUpdate();
        return true;
    } catch (error) {
        logger.debug('Component interaction expired or already acknowledged:', error.message);
        return false;
    }
}

async function sendEphemeralFollowUp(interaction, payload) {
    try {
        await interaction.followUp({
            ...payload,
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        logger.debug('Failed to send ephemeral follow-up:', error.message);
    }
}

function buildDashboardEmbed(cfg, guild) {
    const welcomeChannel = cfg.channelId ? `<#${cfg.channelId}>` : '`Not set`';
    const goodbyeChannel = cfg.goodbyeChannelId ? `<#${cfg.goodbyeChannelId}>` : '`Not set`';

    const rawWelcome = cfg.welcomeMessage || 'Welcome {user} to {server}!';
    const rawGoodbye = cfg.leaveMessage || '{user.tag} has left the server.';
    const welcomePreview = `\`${rawWelcome.length > 55 ? rawWelcome.substring(0, 55) + '…' : rawWelcome}\``;
    const goodbyePreview = `\`${rawGoodbye.length > 55 ? rawGoodbye.substring(0, 55) + '…' : rawGoodbye}\``;

    const welcomeAuthor = cfg.welcomeEmbed?.author ? `\`${cfg.welcomeEmbed.author}\`` : '`Not set`';
    const welcomeFooter = cfg.welcomeEmbed?.footer ? `\`${cfg.welcomeEmbed.footer}\`` : '`Default`';
    const welcomeColor = cfg.welcomeEmbed?.color ? `\`${cfg.welcomeEmbed.color}\`` : '`Default (Success)`';
    const welcomePingDisplay = cfg.welcomePingMessage 
        ? `\`${cfg.welcomePingMessage.length > 35 ? cfg.welcomePingMessage.substring(0, 35) + '…' : cfg.welcomePingMessage}\`` 
        : (cfg.welcomePing ? '`@User`' : '`Off`');

    return new EmbedBuilder()
        .setTitle('👋 Greet System Dashboard')
        .setDescription(
            `Manage welcome & goodbye settings for **${guild.name}**.\nUse the toggles to enable/disable each side, then select an option to edit.`,
        )
        .setColor(getColor('info'))
        .addFields(
            { name: 'Welcome Channel', value: welcomeChannel, inline: true },
            { name: 'Welcome Status', value: cfg.enabled ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Welcome Ping', value: welcomePingDisplay, inline: true },
            { name: 'Welcome Author', value: welcomeAuthor, inline: true },
            { name: 'Welcome Footer', value: welcomeFooter, inline: true },
            { name: 'Welcome Color', value: welcomeColor, inline: true },
            { name: 'Goodbye Channel', value: goodbyeChannel, inline: true },
            { name: 'Goodbye Status', value: cfg.goodbyeEnabled ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Goodbye Ping', value: cfg.goodbyePing ? 'On' : 'Off', inline: true },
            { name: 'Welcome Message', value: welcomePreview, inline: false },
            { name: 'Goodbye Message', value: goodbyePreview, inline: false },
        )
        .setFooter({ text: 'Dashboard closes after 10 minutes of inactivity' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`greet_cfg_${guildId}`)
        .setPlaceholder('Select a setting to configure...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Welcome Channel')
                .setDescription('Set the channel where welcome messages are sent')
                .setValue('welcome_channel')
                .setEmoji('🟢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Welcome Message')
                .setDescription('Edit the text shown when a member joins')
                .setValue('welcome_message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Welcome Image')
                .setDescription('Set the image for welcome messages')
                .setValue('welcome_image')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Welcome Embed Style')
                .setDescription('Configure author, footer, and color for welcome embed')
                .setValue('welcome_embed')
                .setEmoji('🎨'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Welcome Ping Text')
                .setDescription('Set custom text when pinging user (e.g. Chào mừng {user}!)')
                .setValue('welcome_ping_text')
                .setEmoji('🔔'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Goodbye Channel')
                .setDescription('Set the channel where goodbye messages are sent')
                .setValue('goodbye_channel')
                .setEmoji('🔴'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Goodbye Message')
                .setDescription('Edit the text shown when a member leaves')
                .setValue('goodbye_message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Goodbye Image')
                .setDescription('Set the image for goodbye messages')
                .setValue('goodbye_image')
                .setEmoji('🖼️'),
        );
}

function buildButtonRow(cfg, guildId, disabled = false) {
    const welcomeOn = cfg.enabled === true;
    const goodbyeOn = cfg.goodbyeEnabled === true;
    const welcomePingOn = cfg.welcomePing === true;
    const goodbyePingOn = cfg.goodbyePing === true;
    
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`greet_cfg_toggle_welcome_${guildId}`)
                .setLabel('Welcome')
                .setStyle(welcomeOn ? ButtonStyle.Success : ButtonStyle.Danger)
                .setEmoji('🟢')
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId(`greet_cfg_toggle_goodbye_${guildId}`)
                .setLabel('Goodbye')
                .setStyle(goodbyeOn ? ButtonStyle.Success : ButtonStyle.Danger)
                .setEmoji('🔴')
                .setDisabled(disabled),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`greet_cfg_ping_welcome_${guildId}`)
                .setLabel('Ping Welcome')
                .setStyle(welcomePingOn ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🔔')
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId(`greet_cfg_ping_goodbye_${guildId}`)
                .setLabel('Ping Goodbye')
                .setStyle(goodbyePingOn ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🔔')
                .setDisabled(disabled),
        ),
    ];
}

async function refreshDashboard(rootInteraction, cfg, guildId) {
    try {
        const selectMenu = buildSelectMenu(guildId);
        await InteractionHelper.safeEditReply(rootInteraction, {
            embeds: [buildDashboardEmbed(cfg, rootInteraction.guild)],
            components: [
                ...buildButtonRow(cfg, guildId),
                new ActionRowBuilder().addComponents(selectMenu),
            ],
        });
    } catch (error) {
        logger.debug('Could not refresh greet dashboard (interaction may have expired):', error.message);
    }
}

export default {
    prefixOnly: false,
    async execute(interaction, config, client) {
        try {
            const guildId = interaction.guild.id;
            const cfg = await getWelcomeConfig(client, guildId);

            if (!cfg.channelId && !cfg.goodbyeChannelId) {
                throw new TitanBotError(
                    'Greet system not configured',
                    ErrorTypes.CONFIGURATION,
                    'Neither Welcome nor Goodbye has been set up yet. Run `/welcome setup` or `/goodbye setup` first.',
                );
            }

            await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!interaction.deferred) {
                return;
            }

            const selectMenu = buildSelectMenu(guildId);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [buildDashboardEmbed(cfg, interaction.guild)],
                components: [
                    ...buildButtonRow(cfg, guildId),
                    new ActionRowBuilder().addComponents(selectMenu),
                ],
            });

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: i =>
                    i.user.id === interaction.user.id && i.customId === `greet_cfg_${guildId}`,
                time: 600_000,
            });

            collector.on('collect', async selectInteraction => {
                const selectedOption = selectInteraction.values[0];
                try {
                    switch (selectedOption) {
                        case 'welcome_channel':
                            await handleWelcomeChannel(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'welcome_message':
                            await handleWelcomeMessage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'welcome_image':
                            await handleWelcomeImage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'welcome_embed':
                            await handleWelcomeEmbed(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'welcome_ping_text':
                            await handleWelcomePingText(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'goodbye_channel':
                            await handleGoodbyeChannel(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'goodbye_message':
                            await handleGoodbyeMessage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'goodbye_image':
                            await handleGoodbyeImage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                    }
                } catch (error) {
                    if (error instanceof TitanBotError) {
                        logger.debug(`Greet config validation error: ${error.message}`);
                    } else {
                        logger.error('Unexpected greet dashboard error:', error);
                    }

                    const errorMessage =
                        error instanceof TitanBotError
                            ? error.userMessage || 'An error occurred while processing your selection.'
                            : 'An unexpected error occurred while updating the configuration.';

                    if (!selectInteraction.replied && !selectInteraction.deferred) {
                        await selectInteraction.deferUpdate().catch(() => {});
                    }

                    await replyUserError(selectInteraction, {
                        type: ErrorTypes.CONFIGURATION,
                        message: errorMessage,
                    }).catch(() => {});
                }
            });

            const btnCollector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i =>
                    i.user.id === interaction.user.id &&
                    (i.customId === `greet_cfg_toggle_welcome_${guildId}` ||
                        i.customId === `greet_cfg_toggle_goodbye_${guildId}` ||
                        i.customId === `greet_cfg_ping_welcome_${guildId}` ||
                        i.customId === `greet_cfg_ping_goodbye_${guildId}`),
                time: 600_000,
            });

            btnCollector.on('collect', async btnInteraction => {
                try {
                    if (!await deferComponent(btnInteraction)) {
                        return;
                    }

                    const customId = btnInteraction.customId;

                    if (customId === `greet_cfg_toggle_welcome_${guildId}`) {
                        cfg.enabled = !cfg.enabled;
                        await saveWelcomeConfig(client, guildId, cfg);
                        await sendEphemeralFollowUp(btnInteraction, {
                            embeds: [
                                successEmbed(
                                    '✅ Welcome Updated',
                                    `Welcome messages are now **${cfg.enabled ? 'enabled' : 'disabled'}**.`,
                                ),
                            ],
                        });
                    } else if (customId === `greet_cfg_toggle_goodbye_${guildId}`) {
                        cfg.goodbyeEnabled = !cfg.goodbyeEnabled;
                        await saveWelcomeConfig(client, guildId, cfg);
                        await sendEphemeralFollowUp(btnInteraction, {
                            embeds: [
                                successEmbed(
                                    '✅ Goodbye Updated',
                                    `Goodbye messages are now **${cfg.goodbyeEnabled ? 'enabled' : 'disabled'}**.`,
                                ),
                            ],
                        });
                    } else if (customId === `greet_cfg_ping_welcome_${guildId}`) {
                        cfg.welcomePing = !cfg.welcomePing;
                        await saveWelcomeConfig(client, guildId, cfg);
                        await sendEphemeralFollowUp(btnInteraction, {
                            embeds: [
                                successEmbed(
                                    '✅ Welcome Ping Updated',
                                    `Joining users will${cfg.welcomePing ? '' : ' **not**'} be pinged in the welcome message.`,
                                ),
                            ],
                        });
                    } else if (customId === `greet_cfg_ping_goodbye_${guildId}`) {
                        cfg.goodbyePing = !cfg.goodbyePing;
                        await saveWelcomeConfig(client, guildId, cfg);
                        await sendEphemeralFollowUp(btnInteraction, {
                            embeds: [
                                successEmbed(
                                    '✅ Goodbye Ping Updated',
                                    `Leaving users will${cfg.goodbyePing ? '' : ' **not**'} be pinged in the goodbye message.`,
                                ),
                            ],
                        });
                    }

                    await refreshDashboard(interaction, cfg, guildId);
                } catch (error) {
                    logger.error('Error handling greet dashboard button:', error);
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    btnCollector.stop();
                    try {
                        await InteractionHelper.safeEditReply(interaction, {
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('Dashboard Timed Out')
                                    .setDescription('This dashboard has been closed due to inactivity. Please run the command again to continue.')
                                    .setColor(getColor('error'))
                            ],
                            components: [],
                        });
                    } catch (error) {
                        logger.debug('Could not update dashboard on timeout:', error.message);
                    }
                }
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in greet_dashboard:', error);
            throw new TitanBotError(
                `Greet dashboard failed: ${error.message}`,
                ErrorTypes.UNKNOWN,
                'Failed to open the greet dashboard.',
            );
        }
    },
};

async function handleWelcomeChannel(selectInteraction, rootInteraction, cfg, guildId, client) {
    if (!await deferComponent(selectInteraction)) {
        return;
    }

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('greet_cfg_welcome_channel')
        .setPlaceholder('Select a text channel...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await sendEphemeralFollowUp(selectInteraction, {
        embeds: [
            new EmbedBuilder()
                .setTitle('🟢 Welcome Channel')
                .setDescription(
                    `**Current:** ${cfg.channelId ?`<#${cfg.channelId}>`: '`Not set`'}\n\nSelect the channel where welcome messages will be sent.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'greet_cfg_welcome_channel',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInteraction => {
        if (!await deferComponent(chanInteraction)) {
            return;
        }
        const channel = chanInteraction.channels.first();

        if (!botHasPermission(channel, ['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
            await replyUserError(chanInteraction, {
                type: ErrorTypes.PERMISSION,
                message: `I need **View Channel**, **Send Messages**, and **Embed Links** in ${channel}.`,
            });
            return;
        }

        cfg.channelId = channel.id;
        await saveWelcomeConfig(client, guildId, cfg);

        await sendEphemeralFollowUp(chanInteraction, {
            embeds: [successEmbed('Channel Updated', `Welcome messages will now be sent in ${channel}.`)],
        });

        await refreshDashboard(rootInteraction, cfg, guildId);
    });

    chanCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No channel was selected. The setting was not changed.',
            }).catch(() => {});
        }
    });
}

async function handleWelcomeMessage(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_welcome_message')
        .setTitle('Edit Welcome Message')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('message_input')
                    .setLabel('Message (variables: {user}, {server}, etc)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(cfg.welcomeMessage || 'Welcome {user} to {server}!')
                    .setMaxLength(2000)
                    .setMinLength(1)
                    .setRequired(true),
            ),
        );

    try {
        await selectInteraction.showModal(modal);
    } catch {
        return;
    }

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'greet_cfg_welcome_message' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    cfg.welcomeMessage = submitted.fields.getTextInputValue('message_input').trim();
    if (!cfg.welcomeEmbed || typeof cfg.welcomeEmbed !== 'object') {
        cfg.welcomeEmbed = {};
    }
    cfg.welcomeEmbed.description = cfg.welcomeMessage;
    await saveWelcomeConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [successEmbed('Welcome Message Updated', 'The welcome message has been saved.')],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleWelcomeImage(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_welcome_image')
        .setTitle('Set Welcome Image');

    const imageHint = new TextDisplayBuilder()
        .setContent('Provide a direct image URL **or** upload a file below. If both are given, the uploaded file takes priority. Leave the URL blank and skip the upload to remove the image.');

    const urlLabel = new LabelBuilder()
        .setLabel('Image URL (optional)')
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId('image_input')
                .setPlaceholder('https://example.com/welcome.png')
                .setStyle(TextInputStyle.Short)
                .setValue(cfg.welcomeImage || '')
                .setRequired(false),
        );

    const uploadLabel = new LabelBuilder()
        .setLabel('Or upload an image file (optional)')
        .setFileUploadComponent(
            new FileUploadBuilder()
                .setCustomId('image_upload')
                .setRequired(false),
        );

    modal
        .addTextDisplayComponents(imageHint)
        .addLabelComponents(urlLabel, uploadLabel);

    try {
        await selectInteraction.showModal(modal);
    } catch {
        return;
    }

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'greet_cfg_welcome_image' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const uploadedFiles = submitted.fields.getUploadedFiles('image_upload');
    let imageUrl = uploadedFiles?.at(0)?.url ?? submitted.fields.getTextInputValue('image_input').trim();

    if (imageUrl) {
        try {
            new URL(imageUrl);
            if (!['http:', 'https:'].includes(new URL(imageUrl).protocol)) {
                await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'Image URL must start with `http://` or `https://`.' });
                return;
            }
        } catch {
            await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'Please provide a valid image URL.' });
            return;
        }
    }

    cfg.welcomeImage = imageUrl || null;
    if (!cfg.welcomeEmbed || typeof cfg.welcomeEmbed !== 'object') {
        cfg.welcomeEmbed = {};
    }
    if (imageUrl) {
        cfg.welcomeEmbed.image = { url: imageUrl };
    } else {
        delete cfg.welcomeEmbed.image;
    }
    await saveWelcomeConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [successEmbed('Welcome Image Updated', `Image ${imageUrl ? 'updated' : 'removed'} successfully.`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleWelcomeEmbed(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_welcome_embed')
        .setTitle('Edit Welcome Embed Style')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('author_input')
                    .setLabel('Author (variables: {user}, {server})')
                    .setStyle(TextInputStyle.Short)
                    .setValue(cfg.welcomeEmbed?.author || '')
                    .setMaxLength(256)
                    .setPlaceholder('e.g. Welcome to {server}!')
                    .setRequired(false),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('footer_input')
                    .setLabel('Footer (variables: {user}, {server})')
                    .setStyle(TextInputStyle.Short)
                    .setValue(cfg.welcomeEmbed?.footer || '')
                    .setMaxLength(2048)
                    .setPlaceholder('e.g. Member #{memberCount}')
                    .setRequired(false),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('color_input')
                    .setLabel('Color Hex (e.g. #FF0000 or FF0000)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(cfg.welcomeEmbed?.color || '')
                    .setMaxLength(7)
                    .setPlaceholder('#5865F2')
                    .setRequired(false),
            ),
        );

    try {
        await selectInteraction.showModal(modal);
    } catch {
        return;
    }

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'greet_cfg_welcome_embed' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const authorInput = submitted.fields.getTextInputValue('author_input').trim();
    const footerInput = submitted.fields.getTextInputValue('footer_input').trim();
    const colorInput = submitted.fields.getTextInputValue('color_input').trim();

    let resolvedColor = undefined;
    if (colorInput) {
        const hexRegex = /^#?[0-9A-Fa-f]{6}$/;
        if (!hexRegex.test(colorInput)) {
            await replyUserError(submitted, {
                type: ErrorTypes.VALIDATION,
                message: 'Invalid color hex code. Please provide a valid 6-character hex code (e.g., #FF0000 or FF0000).',
            });
            return;
        }
        resolvedColor = colorInput.startsWith('#') ? colorInput : `#${colorInput}`;
    }

    if (!cfg.welcomeEmbed || typeof cfg.welcomeEmbed !== 'object') {
        cfg.welcomeEmbed = {};
    }

    if (authorInput) {
        cfg.welcomeEmbed.author = authorInput;
    } else {
        delete cfg.welcomeEmbed.author;
    }

    if (footerInput) {
        cfg.welcomeEmbed.footer = footerInput;
    } else {
        delete cfg.welcomeEmbed.footer;
    }

    if (resolvedColor !== undefined) {
        cfg.welcomeEmbed.color = resolvedColor;
    } else if (!colorInput) {
        delete cfg.welcomeEmbed.color;
    }

    await saveWelcomeConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [successEmbed('Welcome Embed Updated', 'The welcome embed styling (author, footer, color) has been saved.')],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleWelcomePingText(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_welcome_ping_text')
        .setTitle('Edit Welcome Ping Text')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('ping_text_input')
                    .setLabel('Ping Text (variables: {user}, {server})')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(cfg.welcomePingMessage || '')
                    .setMaxLength(2000)
                    .setPlaceholder('e.g. Chào mừng {user} đã đến với {server}!')
                    .setRequired(false),
            ),
        );

    try {
        await selectInteraction.showModal(modal);
    } catch {
        return;
    }

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'greet_cfg_welcome_ping_text' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const pingTextInput = submitted.fields.getTextInputValue('ping_text_input').trim();

    if (pingTextInput) {
        cfg.welcomePingMessage = pingTextInput;
        cfg.welcomePing = true;
    } else {
        delete cfg.welcomePingMessage;
    }

    await saveWelcomeConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [
            successEmbed(
                'Welcome Ping Text Updated',
                pingTextInput
                    ? `Custom ping text set to: \`${pingTextInput}\``
                    : 'Custom ping text removed. Standard ping will be used if ping is on.',
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleWelcomePing(selectInteraction, rootInteraction, cfg, guildId, client) {
    if (!await deferComponent(selectInteraction)) {
        return;
    }

    cfg.welcomePing = !cfg.welcomePing;
    await saveWelcomeConfig(client, guildId, cfg);

    await sendEphemeralFollowUp(selectInteraction, {
        embeds: [
            successEmbed(
                '✅ Welcome Ping Updated',
                `Joining users will${cfg.welcomePing ? '' : ' **not**'} be pinged in the welcome message.`,
            ),
        ],
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleGoodbyeChannel(selectInteraction, rootInteraction, cfg, guildId, client) {
    if (!await deferComponent(selectInteraction)) {
        return;
    }

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('greet_cfg_goodbye_channel')
        .setPlaceholder('Select a text channel...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await sendEphemeralFollowUp(selectInteraction, {
        embeds: [
            new EmbedBuilder()
                .setTitle('🔴 Goodbye Channel')
                .setDescription(
                    `**Current:** ${cfg.goodbyeChannelId ?`<#${cfg.goodbyeChannelId}>`: '`Not set`'}\n\nSelect the channel where goodbye messages will be sent.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'greet_cfg_goodbye_channel',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInteraction => {
        if (!await deferComponent(chanInteraction)) {
            return;
        }
        const channel = chanInteraction.channels.first();

        if (!botHasPermission(channel, ['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
            await replyUserError(chanInteraction, {
                type: ErrorTypes.PERMISSION,
                message: `I need **View Channel**, **Send Messages**, and **Embed Links** in ${channel}.`,
            });
            return;
        }

        cfg.goodbyeChannelId = channel.id;
        await saveWelcomeConfig(client, guildId, cfg);

        await sendEphemeralFollowUp(chanInteraction, {
            embeds: [successEmbed('Channel Updated', `Goodbye messages will now be sent in ${channel}.`)],
        });

        await refreshDashboard(rootInteraction, cfg, guildId);
    });

    chanCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No channel was selected. The setting was not changed.',
            }).catch(() => {});
        }
    });
}

async function handleGoodbyeMessage(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_goodbye_message')
        .setTitle('Edit Goodbye Message')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('message_input')
                    .setLabel('Message (variables: {user}, {server}, etc)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(cfg.leaveMessage || '{user.tag} has left the server.')
                    .setMaxLength(2000)
                    .setMinLength(1)
                    .setRequired(true),
            ),
        );

    try {
        await selectInteraction.showModal(modal);
    } catch {
        return;
    }

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'greet_cfg_goodbye_message' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    cfg.leaveMessage = submitted.fields.getTextInputValue('message_input').trim();
    await saveWelcomeConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [successEmbed('Goodbye Message Updated', 'The goodbye message has been saved.')],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleGoodbyeImage(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_goodbye_image')
        .setTitle('Set Goodbye Image');

    const imageHint = new TextDisplayBuilder()
        .setContent('Provide a direct image URL **or** upload a file below. If both are given, the uploaded file takes priority. Leave the URL blank and skip the upload to remove the image.');

    const urlLabel = new LabelBuilder()
        .setLabel('Image URL (optional)')
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId('image_input')
                .setPlaceholder('https://example.com/goodbye.png')
                .setStyle(TextInputStyle.Short)
                .setValue(
                    typeof cfg.leaveEmbed?.image === 'string'
                        ? cfg.leaveEmbed.image
                        : cfg.leaveEmbed?.image?.url || ''
                )
                .setRequired(false),
        );

    const uploadLabel = new LabelBuilder()
        .setLabel('Or upload an image file (optional)')
        .setFileUploadComponent(
            new FileUploadBuilder()
                .setCustomId('image_upload')
                .setRequired(false),
        );

    modal
        .addTextDisplayComponents(imageHint)
        .addLabelComponents(urlLabel, uploadLabel);

    try {
        await selectInteraction.showModal(modal);
    } catch {
        return;
    }

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'greet_cfg_goodbye_image' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const uploadedFiles = submitted.fields.getUploadedFiles('image_upload');
    let imageUrl = uploadedFiles?.at(0)?.url ?? submitted.fields.getTextInputValue('image_input').trim();

    if (imageUrl) {
        try {
            new URL(imageUrl);
            if (!['http:', 'https:'].includes(new URL(imageUrl).protocol)) {
                await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'Image URL must start with `http://` or `https://`.' });
                return;
            }
        } catch {
            await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'Please provide a valid image URL.' });
            return;
        }
    }

    const nextLeaveEmbed = { ...(cfg.leaveEmbed || {}) };
    if (imageUrl) {
        nextLeaveEmbed.image = imageUrl;
    } else {
        delete nextLeaveEmbed.image;
    }

    cfg.leaveEmbed = nextLeaveEmbed;
    await saveWelcomeConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [successEmbed('Goodbye Image Updated', `Image ${imageUrl ? 'updated' : 'removed'} successfully.`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleGoodbyePing(selectInteraction, rootInteraction, cfg, guildId, client) {
    if (!await deferComponent(selectInteraction)) {
        return;
    }

    cfg.goodbyePing = !cfg.goodbyePing;
    await saveWelcomeConfig(client, guildId, cfg);

    await sendEphemeralFollowUp(selectInteraction, {
        embeds: [
            successEmbed(
                '✅ Goodbye Ping Updated',
                `Leaving users will${cfg.goodbyePing ? '' : ' **not**'} be pinged in the goodbye message.`,
            ),
        ],
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}