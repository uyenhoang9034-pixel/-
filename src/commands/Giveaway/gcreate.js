import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    MessageFlags,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { saveGiveaway } from '../../utils/giveaways.js';
import { 
    parseDuration, 
    validatePrize, 
    validateWinnerCount,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { botConfig } from '../../config/bot.js';

const GIVEAWAY_MIN_WINNERS = botConfig.giveaways?.minimumWinners ?? 1;
const GIVEAWAY_MAX_WINNERS = botConfig.giveaways?.maximumWinners ?? 10;

export default {
    data: new SlashCommandBuilder()
        .setName("gcreate")
        .setDescription("Giveaway management commands.")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("create")
                .setDescription("Starts a new giveaway in a specified channel.")
                .addStringOption((option) =>
                    option
                        .setName("duration")
                        .setDescription("How long the giveaway should last (e.g., 1h, 30m, 5d).")
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("winners")
                        .setDescription("The number of winners to pick.")
                        .setMinValue(GIVEAWAY_MIN_WINNERS)
                        .setMaxValue(GIVEAWAY_MAX_WINNERS)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("prize")
                        .setDescription("The prize being given away.")
                        .setRequired(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("The channel to send the giveaway to (defaults to current channel).")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dashboard")
                .setDescription("Configure giveaway appearance settings.")
                .addStringOption((option) =>
                    option
                        .setName("color")
                        .setDescription("Hex color code (e.g., #E91E63)")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("emoji")
                        .setDescription("Button emoji (e.g., 🎁, 🎉)")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("banner")
                        .setDescription("Large banner image URL")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("thumbnail")
                        .setDescription("Small thumbnail image URL")
                        .setRequired(false)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

        if (!interaction.inGuild()) {
            throw new TitanBotError(
                'Giveaway command used outside guild',
                ErrorTypes.VALIDATION,
                'This command can only be used in a server.',
                { userId: interaction.user.id }
            );
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            throw new TitanBotError(
                'User lacks ManageGuild permission',
                ErrorTypes.PERMISSION,
                "You need the 'Manage Server' permission to manage giveaways.",
                { userId: interaction.user.id, guildId: interaction.guildId }
            );
        }

        const subcommand = interaction.options.getSubcommand();

        // -------------------------------------------------------------
        // SUBCOMMAND: DASHBOARD (Appearance Customization)
        // -------------------------------------------------------------
        if (subcommand === 'dashboard') {
            const color = interaction.options.getString("color");
            const emoji = interaction.options.getString("emoji") || "🎁";
            const banner = interaction.options.getString("banner");
            const thumbnail = interaction.options.getString("thumbnail");

            const activeColor = color ? parseInt(color.replace('#', ''), 16) : 0xE91E63;

            // Generate Dashboard Live Preview Embed
            const previewEmbed = new EmbedBuilder()
                .setTitle("x5 DECA0R 66K (Dashboard Preview)")
                .setColor(activeColor)
                .setDescription(
                    `${emoji} Click the button below to enter!\n\n` +
                    `✨ • **Ends:** <t:${Math.floor(Date.now() / 1000) + 10800}:R>\n` +
                    `✨ • **Hosted by:** ${interaction.user}`
                )
                .setFooter({ text: "5 winner(s) • Ends" });

            if (thumbnail) previewEmbed.setThumbnail(thumbnail);
            if (banner) previewEmbed.setImage(banner);

            const previewButton = new ButtonBuilder()
                .setCustomId("preview_btn")
                .setLabel("Enter")
                .setEmoji(emoji)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true);

            const row = new ActionRowBuilder().addComponents(previewButton);

            logger.info(`Giveaway dashboard updated by ${interaction.user.tag} in guild ${interaction.guildId}`);

            return await InteractionHelper.safeReply(interaction, {
                content: "✅ **Giveaway dashboard settings updated successfully!** Here is a preview of your layout:",
                embeds: [previewEmbed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        }

        // -------------------------------------------------------------
        // SUBCOMMAND: CREATE (Start Giveaway)
        // -------------------------------------------------------------
        if (subcommand === 'create') {
            logger.info(`Giveaway creation started by ${interaction.user.tag} in guild ${interaction.guildId}`);

            const durationString = interaction.options.getString("duration");
            const winnerCount = interaction.options.getInteger("winners");
            const prize = interaction.options.getString("prize");
            const targetChannel = interaction.options.getChannel("channel") || interaction.channel;

            const durationMs = parseDuration(durationString);
            validateWinnerCount(winnerCount);
            const prizeName = validatePrize(prize);

            if (!targetChannel.isTextBased()) {
                throw new TitanBotError(
                    'Target channel is not text-based',
                    ErrorTypes.VALIDATION,
                    'The channel must be a text channel.',
                    { channelId: targetChannel.id, channelType: targetChannel.type }
                );
            }

            const endTime = Date.now() + durationMs;

            const initialGiveawayData = {
                messageId: "placeholder",
                channelId: targetChannel.id,
                guildId: interaction.guildId,
                prize: prizeName,
                hostId: interaction.user.id,
                endTime: endTime,
                endsAt: endTime,
                winnerCount: winnerCount,
                participants: [],
                isEnded: false,
                ended: false,
                createdAt: new Date().toISOString()
            };

            const embed = createGiveawayEmbed(initialGiveawayData, "active");
            const row = createGiveawayButtons(false);

            const giveawayMessage = await targetChannel.send({
                content: "🪽✨ **GIVEAWAYS** ✨🪽",
                embeds: [embed],
                components: [row],
            });

            initialGiveawayData.messageId = giveawayMessage.id;
            const saved = await saveGiveaway(
                interaction.client,
                interaction.guildId,
                initialGiveawayData,
            );

            if (!saved) {
                logger.warn(`Failed to save giveaway to database: ${giveawayMessage.id}`);
            }

            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_CREATE,
                    data: {
                        description: `Giveaway created: ${prizeName}`,
                        channelId: targetChannel.id,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: 'Prize',
                                value: prizeName,
                                inline: true
                            },
                            {
                                name: 'Winners',
                                value: winnerCount.toString(),
                                inline: true
                            },
                            {
                                name: 'Duration',
                                value: durationString,
                                inline: true
                            },
                            {
                                name: 'Channel',
                                value: targetChannel.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Error logging giveaway creation event:', logError);
            }

            logger.info(`Giveaway created successfully: ${giveawayMessage.id} in ${targetChannel.name}`);

            await InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        `Giveaway Started! 🎉`,
                        `A new giveaway for **${prizeName}** has been started in ${targetChannel} and will end in **${durationString}**.`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
