import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} from 'discord.js';
import { editGiveawayDetails, endGiveaway } from '../services/giveawayService.js';
import { getGiveawayByMessageId } from '../utils/database.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
    .setName('giveaway-dashboard')
    .setDescription('Open Control Panel & edit giveaway details')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option => 
        option.setName('message_id')
            .setDescription('The message ID of the giveaway to edit')
            .setRequired(true)
    );

export async function execute(interaction) {
    const messageId = interaction.options.getString('message_id');
    const giveawayRecord = await getGiveawayByMessageId(interaction.client, messageId);

    if (!giveawayRecord) {
        return interaction.reply({
            content: '❌ Giveaway data not found for the provided Message ID.',
            ephemeral: true
        });
    }

    const giveawayData = typeof giveawayRecord.data === 'string' 
        ? JSON.parse(giveawayRecord.data) 
        : giveawayRecord.data;

    const panelEmbed = new EmbedBuilder()
        .setTitle('⚙️ Giveaway Control Panel')
        .setDescription(`Managing Giveaway ID: \`${messageId}\`\n**Prize:** ${giveawayData.prize}`)
        .setColor(0x5865F2)
        .addFields(
            { name: '📝 Title', value: giveawayData.title || giveawayData.prize, inline: true },
            { name: '🎨 Color', value: giveawayData.color || 'Default (#E91E63)', inline: true },
            { name: '🎁 Emoji', value: giveawayData.emoji || '🎁', inline: true },
            { name: '🖼️ Banner/Thumbnail', value: giveawayData.bannerUrl || giveawayData.thumbnailUrl ? 'Configured' : 'Not set', inline: true },
            { name: '⏱️ Timestamp', value: giveawayData.showTimestamp !== false ? 'Enabled' : 'Disabled', inline: true }
        )
        .setFooter({ text: 'Select a button below to customize details.' });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`gw_edit_main_${messageId}`)
            .setLabel('Edit Content')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`gw_edit_media_${messageId}`)
            .setLabel('Edit Media & Footer')
            .setEmoji('🖼️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`gw_toggle_time_${messageId}`)
            .setLabel('Toggle Timestamp')
            .setEmoji('⏱️')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`gw_quick_end_${messageId}`)
            .setLabel('End Now')
            .setEmoji('🛑')
            .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
        embeds: [panelEmbed],
        components: [row1, row2],
        ephemeral: true
    });
}

export async function handleDashboardInteraction(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    const { customId, client } = interaction;

    // 1. OPEN MAIN CONTENT MODAL BUTTON
    if (interaction.isButton() && customId.startsWith('gw_edit_main_')) {
        const messageId = customId.replace('gw_edit_main_', '');
        const giveawayRecord = await getGiveawayByMessageId(client, messageId);
        const data = typeof giveawayRecord?.data === 'string' ? JSON.parse(giveawayRecord.data) : giveawayRecord?.data;

        const modal = new ModalBuilder()
            .setCustomId(`modal_gw_main_${messageId}`)
            .setTitle('Edit Giveaway Content');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Giveaway Title')
            .setValue(data?.title || data?.prize || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const descInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description ({emoji},{prize},{endsAt},{host})')
            .setValue(data?.description || '')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter custom description...')
            .setRequired(false);

        const colorInput = new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Hex Color Code (e.g., #FF0055)')
            .setValue(data?.color || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const emojiInput = new TextInputBuilder()
            .setCustomId('emoji')
            .setLabel('Entry Emoji (e.g., 🎉)')
            .setValue(data?.emoji || '🎁')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput),
            new ActionRowBuilder().addComponents(colorInput),
            new ActionRowBuilder().addComponents(emojiInput)
        );

        return interaction.showModal(modal);
    }

    // 2. OPEN MEDIA & FOOTER MODAL BUTTON
    if (interaction.isButton() && customId.startsWith('gw_edit_media_')) {
        const messageId = customId.replace('gw_edit_media_', '');
        const giveawayRecord = await getGiveawayByMessageId(client, messageId);
        const data = typeof giveawayRecord?.data === 'string' ? JSON.parse(giveawayRecord.data) : giveawayRecord?.data;

        const modal = new ModalBuilder()
            .setCustomId(`modal_gw_media_${messageId}`)
            .setTitle('Edit Media & Footer');

        const bannerInput = new TextInputBuilder()
            .setCustomId('bannerUrl')
            .setLabel('Large Banner Image URL')
            .setValue(data?.bannerUrl || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const thumbInput = new TextInputBuilder()
            .setCustomId('thumbnailUrl')
            .setLabel('Thumbnail Image URL')
            .setValue(data?.thumbnailUrl || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const footerTextInput = new TextInputBuilder()
            .setCustomId('footerText')
            .setLabel('Footer Text ({winnerCount}, {entries})')
            .setValue(data?.footerText || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const footerIconInput = new TextInputBuilder()
            .setCustomId('footerIcon')
            .setLabel('Footer Icon URL')
            .setValue(data?.footerIcon || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(bannerInput),
            new ActionRowBuilder().addComponents(thumbInput),
            new ActionRowBuilder().addComponents(footerTextInput),
            new ActionRowBuilder().addComponents(footerIconInput)
        );

        return interaction.showModal(modal);
    }

    // 3. TOGGLE TIMESTAMP BUTTON
    if (interaction.isButton() && customId.startsWith('gw_toggle_time_')) {
        const messageId = customId.replace('gw_toggle_time_', '');
        const giveawayRecord = await getGiveawayByMessageId(client, messageId);
        const data = typeof giveawayRecord?.data === 'string' ? JSON.parse(giveawayRecord.data) : giveawayRecord?.data;

        const currentStatus = data?.showTimestamp !== false;
        await editGiveawayDetails(client, messageId, { showTimestamp: !currentStatus });

        return interaction.reply({
            content: `✅ Timestamp display has been ${!currentStatus ? 'enabled' : 'disabled'}!`,
            ephemeral: true
        });
    }

    // 4. QUICK END BUTTON
    if (interaction.isButton() && customId.startsWith('gw_quick_end_')) {
        const messageId = customId.replace('gw_quick_end_', '');
        const giveawayRecord = await getGiveawayByMessageId(client, messageId);
        const giveawayData = typeof giveawayRecord?.data === 'string' 
            ? JSON.parse(giveawayRecord.data) 
            : giveawayRecord?.data;

        if (!giveawayData) {
            return interaction.reply({ content: '❌ Giveaway data not found.', ephemeral: true });
        }

        const result = await endGiveaway(client, giveawayData, interaction.guildId, interaction.user.id);
        return interaction.reply({ 
            content: `🛑 Giveaway ended! Selected **${result.winners.length}** winner(s).`, 
            ephemeral: true 
        });
    }

    // 5. SUBMIT MAIN CONTENT MODAL
    if (interaction.isModalSubmit() && customId.startsWith('modal_gw_main_')) {
        const messageId = customId.replace('modal_gw_main_', '');

        const updates = {
            title: interaction.fields.getTextInputValue('title') || undefined,
            description: interaction.fields.getTextInputValue('description') || undefined,
            color: interaction.fields.getTextInputValue('color') || undefined,
            emoji: interaction.fields.getTextInputValue('emoji') || '🎁'
        };

        await editGiveawayDetails(client, messageId, updates);
        return interaction.reply({ content: '✅ Giveaway content successfully updated!', ephemeral: true });
    }

    // 6. SUBMIT MEDIA & FOOTER MODAL
    if (interaction.isModalSubmit() && customId.startsWith('modal_gw_media_')) {
        const messageId = customId.replace('modal_gw_media_', '');

        const updates = {
            bannerUrl: interaction.fields.getTextInputValue('bannerUrl') || undefined,
            thumbnailUrl: interaction.fields.getTextInputValue('thumbnailUrl') || undefined,
            footerText: interaction.fields.getTextInputValue('footerText') || undefined,
            footerIcon: interaction.fields.getTextInputValue('footerIcon') || undefined
        };

        await editGiveawayDetails(client, messageId, updates);
        return interaction.reply({ content: '✅ Media and footer details successfully updated!', ephemeral: true });
    }
}
