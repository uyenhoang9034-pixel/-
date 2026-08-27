import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } from 'discord.js';
import { getWelcomeConfig, updateWelcomeConfig } from '../../utils/database.js';
import { formatWelcomeMessage, truncateForEmbedField } from '../../utils/welcome.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ErrorTypes, replyUserError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure the welcome system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up the welcome message')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send welcome messages to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Welcome message. Variables: {user}, {username}, {server}, {memberCount}')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('URL of the image to include in the welcome message')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('ping')
                        .setDescription('Whether to ping the user in the welcome message')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('ping_message')
                        .setDescription('Custom text when pinging user (e.g. Chào mừng {user}!). Leave empty for standard ping')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('author')
                        .setDescription('Author text for the welcome embed. Variables: {user}, {username}, {server}')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer')
                        .setDescription('Footer text for the welcome embed. Variables: {user}, {username}, {server}')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Hex color code for the welcome embed (e.g., #FF0000)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Test the welcome message rendering in the configured channel')),

    async execute(interaction) {
        try {
            const deferSuccess = await InteractionHelper.safeDefer(interaction);
            if (!deferSuccess) {
                logger.warn(`Welcome interaction defer failed`, {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'welcome'
                });
                return;
            }
        } catch (deferError) {
            logger.error(`Welcome defer error`, { error: deferError.message });
            return;
        }

        const { options, guild, client } = interaction;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need the **Manage Server** permission to use `/welcome`.' });
        }

        const subcommand = options.getSubcommand();

        if (subcommand === 'setup') {
            const channel = options.getChannel('channel');
            const message = options.getString('message');
            const image = options.getString('image');
            const ping = options.getBoolean('ping') ?? false;
            const pingMessage = options.getString('ping_message');
            const author = options.getString('author');
            const footer = options.getString('footer');
            const color = options.getString('color');

            const existingConfig = await getWelcomeConfig(client, guild.id);
            
            if (!message || message.trim().length === 0) {
                logger.warn(`[Welcome] Empty message provided by ${interaction.user.tag} in ${guild.name}`);
                return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Welcome message cannot be empty' });
            }

            if (image) {
                try {
                    new URL(image);
                } catch (e) {
                    logger.warn(`[Welcome] Invalid image URL provided by ${interaction.user.tag}: ${image}`);
                    return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Please provide a valid image URL (must start with http:// or https://)' });
                }
            }

            let resolvedColor = undefined;
            if (color) {
                const hexRegex = /^#?[0-9A-Fa-f]{6}$/;
                if (!hexRegex.test(color)) {
                    logger.warn(`[Welcome] Invalid color hex code provided by ${interaction.user.tag}: ${color}`);
                    return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Invalid color hex code. Please provide a valid 6-character hex code (e.g., #FF0000 or FF0000).' });
                }
                resolvedColor = color.startsWith('#') ? color : `#${color}`;
            }

            try {
                const updatedEmbed = {
                    ...(existingConfig?.welcomeEmbed || {}),
                    description: message
                };
                if (author !== null) updatedEmbed.author = author || undefined;
                if (footer !== null) updatedEmbed.footer = footer || undefined;
                if (resolvedColor !== undefined) updatedEmbed.color = resolvedColor;

                await updateWelcomeConfig(client, guild.id, {
                    enabled: true,
                    channelId: channel.id,
                    welcomeMessage: message,
                    welcomeImage: image || undefined,
                    welcomePing: ping || Boolean(pingMessage),
                    welcomePingMessage: pingMessage || undefined,
                    welcomeEmbed: updatedEmbed
                });

                logger.info(`[Welcome] Setup configured by ${interaction.user.tag} for guild ${guild.name} (${guild.id})`);

                const previewMessage = formatWelcomeMessage(message, {
                    user: interaction.user,
                    guild
                });

                const embedColor = resolvedColor || getColor('success');
                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('Welcome System Configured')
                    .setDescription(`Welcome messages will now be sent to ${channel}`)
                    .addFields(
                        { name: 'Message Preview', value: truncateForEmbedField(previewMessage) },
                        { name: 'Ping User', value: ping || Boolean(pingMessage) ? 'Yes' : 'No' },
                        { name: 'Status', value: 'Enabled' }
                    )
                    .setFooter({ text: 'Tip: Use /greet dashboard to customize welcome settings' });

                if (pingMessage) {
                    const previewPing = formatWelcomeMessage(pingMessage, { user: interaction.user, guild });
                    embed.addFields({ name: 'Ping Message Preview', value: truncateForEmbedField(previewPing) });
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
                logger.error(`[Welcome] Failed to setup welcome system for guild ${guild.id}:`, error);
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'An error occurred while configuring the welcome system. Please try again.' });
            }
        } else if (subcommand === 'test') {
            try {
                const welcomeConfig = await getWelcomeConfig(client, guild.id);
                const welcomeChannelId = welcomeConfig?.channelId;

                if (!welcomeConfig?.enabled || !welcomeChannelId) {
                    return await replyUserError(interaction, { 
                        type: ErrorTypes.CONFIGURATION, 
                        message: 'The welcome system is not enabled or configured yet. Run **/welcome setup** first.' 
                    });
                }

                const channel = guild.channels.cache.get(welcomeChannelId);
                if (!channel) {
                    return await replyUserError(interaction, { 
                        type: ErrorTypes.UNKNOWN, 
                        message: 'Could not find the configured welcome channel. Please make sure the channel exists and the bot has access.' 
                    });
                }

                const me = guild.members.me;
                const permissions = channel.permissionsFor(me);
                if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
                    return await replyUserError(interaction, { 
                        type: ErrorTypes.PERMISSION, 
                        message: `I do not have permission to view or send messages in ${channel}.` 
                    });
                }

                const formatData = { user: interaction.user, guild, member: interaction.member };
                const welcomeMessage = formatWelcomeMessage(
                    welcomeConfig.welcomeMessage || welcomeConfig.welcomeEmbed?.description || 'Welcome {user} to {server}!',
                    formatData
                );

                let messageContent = null;
                if (welcomeConfig.welcomePingMessage) {
                    messageContent = formatWelcomeMessage(welcomeConfig.welcomePingMessage, formatData);
                    if (!messageContent.includes(interaction.user.id) && welcomeConfig.welcomePing !== false) {
                        messageContent = `${messageContent} ${interaction.user.toString()}`;
                    }
                } else if (welcomeConfig.welcomePing) {
                    messageContent = interaction.user.toString();
                }

                const embedTitle = formatWelcomeMessage(
                    welcomeConfig.welcomeEmbed?.title || '🎉 Welcome!',
                    formatData
                );
                const embedFooter = welcomeConfig.welcomeEmbed?.footer
                    ? formatWelcomeMessage(welcomeConfig.welcomeEmbed.footer, formatData)
                    : `Welcome to ${guild.name}!`;

                const canEmbed = permissions.has(PermissionFlagsBits.EmbedLinks);

                if (!canEmbed) {
                    await channel.send({
                        content: messageContent || welcomeMessage
                    });
                } else {
                    const embed = new EmbedBuilder()
                        .setColor(welcomeConfig.welcomeEmbed?.color || getColor('success'))
                        .setTitle(embedTitle)
                        .setDescription(welcomeMessage)
                        .setThumbnail(interaction.user.displayAvatarURL())
                        .addFields(
                            { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                            { name: 'Member Count', value: guild.memberCount.toString(), inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: embedFooter });

                    if (welcomeConfig.welcomeEmbed?.author) {
                        const embedAuthor = formatWelcomeMessage(welcomeConfig.welcomeEmbed.author, formatData);
                        embed.setAuthor({ name: embedAuthor });
                    }

                    if (welcomeConfig.welcomeImage) {
                        embed.setImage(welcomeConfig.welcomeImage);
                    } else if (welcomeConfig.welcomeEmbed?.image?.url) {
                        embed.setImage(welcomeConfig.welcomeEmbed.image.url);
                    }

                    await channel.send({
                        content: messageContent,
                        embeds: [embed]
                    });
                }

                await InteractionHelper.safeEditReply(interaction, { 
                    content: `✅ Test welcome message has been successfully sent to ${channel}!` 
                });
            } catch (error) {
                logger.error(`[Welcome Test] Failed to send test welcome message:`, error);
                await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: 'Failed to send test message. Please verify my permissions in the welcome channel.' 
                });
            }
        }
    },
};