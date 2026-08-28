import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { parseDuration, validatePrize, validateWinnerCount, createGiveawayEmbed, createGiveawayButtons } from '../services/giveawayService.js';
import { updateGiveawayData } from '../utils/database.js';

export const data = new SlashCommandBuilder()
    .setName('giveaway-create')
    .setDescription('Create a new giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option => 
        option.setName('duration')
            .setDescription('Giveaway duration (e.g., 1h, 1d, 30m)')
            .setRequired(true))
    .addIntegerOption(option => 
        option.setName('winners')
            .setDescription('Number of winners')
            .setRequired(true))
    .addStringOption(option => 
        option.setName('prize')
            .setDescription('Prize to be won')
            .setRequired(true))
    .addChannelOption(option => 
        option.setName('channel')
            .setDescription('Target channel (defaults to current channel)')
            .setRequired(false));

export async function execute(interaction) {
    const durationInput = interaction.options.getString('duration');
    const winnerCount = interaction.options.getInteger('winners');
    const prizeInput = interaction.options.getString('prize');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    const durationMs = parseDuration(durationInput);
    const prize = validatePrize(prizeInput);
    validateWinnerCount(winnerCount);

    const endsAt = Date.now() + durationMs;
    const giveawayData = {
        prize,
        winnerCount,
        endsAt,
        hostId: interaction.user.id,
        channelId: targetChannel.id,
        participants: [],
        ended: false
    };

    const embed = createGiveawayEmbed(giveawayData, 'active');
    const buttons = createGiveawayButtons(false);

    const message = await targetChannel.send({ embeds: [embed], components: [buttons] });
    giveawayData.messageId = message.id;

    await updateGiveawayData(interaction.client, message.id, giveawayData);

    await interaction.reply({ 
        content: `✅ Giveaway for **${prize}** has been successfully created in ${targetChannel}!`, 
        ephemeral: true 
    });
}
