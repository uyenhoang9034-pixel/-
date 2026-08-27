import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import { getWelcomeConfig, updateWelcomeConfig } from '../../utils/database.js';
import { formatWelcomeMessage, truncateForEmbedField } from '../../utils/welcome.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ErrorTypes, replyUserError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('goodbye')
        .setDescription('Configure the goodbye message system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up the goodbye message')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send goodbye messages to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Goodbye message. Variables: {user}, {username}, {server}, {memberCount}')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('URL of the image to include in the goodbye message')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('ping')
                        .setDescription('Whether to ping the user in the goodbye message')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('ping_message')
                        .setDescription('Custom text when pinging user (e.g. Tạm biệt {user}!). Leave empty for standard ping')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Title for the goodbye embed. Variables: {user}, {username}, {server}')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('author')
                        .setDescription('Author text for the goodbye embed. Variables: {user}, {username}, {server}')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer')
                        .setDescription('Footer text for the goodbye embed. Variables: {user}, {username}, {server}')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Hex color code for the goodbye embed (e.g., #FF0000)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Test the goodbye message rendering in the configured channel')),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Goodbye interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'goodbye'
            });
            return;
        }

        const { options, guild, client } = interaction;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need the **Manage Server** permission to use `/goodbye`.' });
        }

        const subcommand = options.getSubcommand();

        if (subcommand === 'setup') {
            const channel = options.getChannel('channel');
            const message = options.getString('message');
            const image = options.getString('image');
            const ping = options.getBoolean('ping') ?? false;
            const pingMessage = options.getString('ping_message');
            const title = options.getString('title');
            const author = options.getString('author');
            const footer = options.getString('footer');
            const color = options.getString('color');

            const existingConfig = await getWelcomeConfig(client, guild.id);

            if (!message || message.trim().length === 0) {
                logger.warn(`[Goodbye] Empty message provided by ${interaction.user.tag} in ${guild.name}`);
                return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Goodbye message cannot be empty' });
            }

            if (image) {
                try {
                    new URL(image);
                } catch (e) {
                    logger.warn(`[Goodbye] Invalid image URL provided by ${interaction.user.tag}: ${image}`);
                    return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Please provide a valid image URL (must start with http:// or https://)' });
                }
            }

            let resolvedColor = undefined;
            if (color) {
                const hexRegex = /^#?[0-9A-Fa-f]{6}$/;
                if (!hexRegex.test(color)) {
                    logger.warn(`[Goodbye] Invalid color hex code provided by ${interaction.user.tag}: ${color}`);
                    return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Invalid color hex code. Please provide a valid 6-character hex code (e.g., #FF0000 or FF0000).' });
                }
                resolvedColor = color.startsWith('#') ? color : `#${color}`;
            }

            try {
                const updatedEmbed = {
                    ...(existingConfig?.leaveEmbed || {}),
                    description: message
                };
                if (title !== null) updatedEmbed.title = title || undefined;
                if (author !== null) updatedEmbed.author = author || undefined;
                if (footer !== null) updatedEmbed.footer = footer || undefined;
                if (resolvedColor !== undefined) updatedEmbed.color = resolvedColor;
                if (image) updatedEmbed.image = { url: image };

                await updateWelcomeConfig(client, guild.id, {
                    goodbyeEnabled: true,
                    goodbyeChannelId: channel.id,
                    leaveMessage: message,
                    goodbyeImage: image || undefined,
                    goodbyePing: ping || Boolean(pingMessage),
                    goodbyePingMessage: pingMessage || undefined,
                    leaveEmbed: updatedEmbed
                });

                logger.info(`[Goodbye] Setup configured by ${interaction.user.tag} for guild ${guild.name} (${guild.id})`);

                const previewMessage = formatWelcomeMessage(message, {
                    user: interaction.user,
                    guild
                });

                const embedColor = resolvedColor || getColor('error');
                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('Goodbye System Configured')
                    .setDescription(`Goodbye messages will now be sent to ${channel}`)
                    .addFields(
                        { name: 'Message Preview', value: truncateForEmbedField(previewMessage) },
                        { name: 'Ping User', value: ping || Boolean(pingMessage) ? 'Yes' : 'No' },
                        { name: 'Status', value: 'Enabled' }
                    )
                    .setFooter({ text: 'Tip: Use /greet dashboard to customize goodbye settings' });

                if (pingMessage) {
                    const previewPing = formatWelcomeMessage(pingMessage, { user: interaction.user, guild });
                    embed.addFields({ name: 'Ping Message Preview', value: truncateForEmbedField(previewPing) });
                }
                if (title) {
                    const previewTitle = formatWelcomeMessage(title, { user: interaction.user, guild });
                    embed.addFields({ name: 'Title Preview', value: truncateForEmbedField(previewTitle) });
                }
                if (author) {
                    const previewAuthor = formatWelcomeMessage(author, { user: interaction.user, guild });
                    embed.addFields({ name: 'Author Preview', value: truncateForEmbedField(previewAuthor) });
                }
                if (footer) {
                    const previewFooter = formatWelcomeMessage(footer, { user: interaction.user, guild });
                    embed.addFields({ name: 'Footer Preview', value: truncateForEmbedField(previewFooter) });
                }
                if (image) {
                    embed.setImage(image);
                }

                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } catch (error) {
                logger.error(`[Goodbye] Failed to setup goodbye system for guild ${guild.id}:`, error);
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'An error occurred while configuring the goodbye system. Please try again.' });
            }
        } else if (subcommand === 'test') {
            try {
                const welcomeConfig = await getWelcomeConfig(client, guild.id);

                if (!welcomeConfig.goodbyeChannelId) {
                    return await replyUserError(interaction, {
                        type: ErrorTypes.VALIDATION,
                        message: 'Goodbye channel is not configured yet. Run `/goodbye setup` first.'
                    });
                }

                const channel = guild.channels.cache.get(welcomeConfig.goodbyeChannelId);
                if (!channel || !channel.isTextBased()) {
                    return await replyUserError(interaction, {
                        type: ErrorTypes.VALIDATION,
                        message: 'Configured goodbye channel was not found or is not a text channel.'
                    });
                }

                const me = guild.members.me;
                const permissions = me ? channel.permissionsFor(me) : null;
                if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
                    return await replyUserError(interaction, {
                        type: ErrorTypes.PERMISSION,
                        message: `I do not have permission to view or send messages in ${channel}.`
                    });
                }

                const formatData = { user: interaction.user, guild, member: interaction.member };
                const goodbyeMessage = formatWelcomeMessage(
                    welcomeConfig.leaveMessage || welcomeConfig.leaveEmbed?.description || '{user} has left the server.',
                    formatData
                );

                let messageContent = null;
                if (welcomeConfig.goodbyePingMessage && welcomeConfig.goodbyePingMessage.trim()) {
                    messageContent = formatWelcomeMessage(welcomeConfig.goodbyePingMessage, formatData);
                } else if (welcomeConfig.goodbyePing) {
                    messageContent = interaction.user.toString();
                }

                const embedTitle = formatWelcomeMessage(
                    welcomeConfig.leaveEmbed?.title || '👋 Goodbye',
                    formatData
                );
                const rawFooter = typeof welcomeConfig.leaveEmbed?.footer === 'object' && welcomeConfig.leaveEmbed?.footer !== null
                    ? welcomeConfig.leaveEmbed.footer.text
                    : welcomeConfig.leaveEmbed?.footer;
                const footerTemplate = (rawFooter && rawFooter.trim().length > 0) ? rawFooter : `Goodbye from {server_name}!`;
                const embedFooter = formatWelcomeMessage(footerTemplate, formatData);

                const canEmbed = permissions.has(PermissionFlagsBits.EmbedLinks);

                if (!canEmbed) {
                    await channel.send({
                        content: messageContent || goodbyeMessage
                    });
                } else {
                    const embed = new EmbedBuilder()
                        .setColor(welcomeConfig.leaveEmbed?.color || getColor('error'))
                        .setTitle(embedTitle)
                        .setDescription(goodbyeMessage)
                        .setThumbnail(interaction.user.displayAvatarURL())
                        .setTimestamp();

                    if (embedFooter && embedFooter.trim()) {
                        embed.setFooter({
                            text: embedFooter.trim(),
                            iconURL: guild.iconURL() || undefined
                        });
                    }

                    if (welcomeConfig.leaveEmbed?.author) {
                        const embedAuthor = formatWelcomeMessage(welcomeConfig.leaveEmbed.author, formatData);
                        embed.setAuthor({ name: embedAuthor });
                    }

                    const goodbyeImage = welcomeConfig.goodbyeImage || welcomeConfig.leaveImage || (typeof welcomeConfig.leaveEmbed?.image === 'string' ? welcomeConfig.leaveEmbed.image : welcomeConfig.leaveEmbed?.image?.url);
                    if (goodbyeImage) {
                        embed.setImage(goodbyeImage);
                    }

                    await channel.send({
                        content: messageContent,
                        embeds: [embed]
                    });
                }

                await InteractionHelper.safeEditReply(interaction, {
                    content: `✅ Test goodbye message has been successfully sent to ${channel}!`
                });
            } catch (error) {
                logger.error(`[Goodbye Test] Failed to send test goodbye message:`, error);
                await replyUserError(interaction, {
                    type: ErrorTypes.UNKNOWN,
                    message: 'Failed to send test goodbye message. Please verify my permissions in the goodbye channel.'
                });
            }
        }
    },
};