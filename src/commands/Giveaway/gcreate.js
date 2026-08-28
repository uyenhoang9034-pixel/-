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
    .setDescription('Mở Bảng quản trị & Chỉnh sửa chi tiết Giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option => 
        option.setName('message_id')
            .setDescription('ID tin nhắn của Giveaway cần chỉnh sửa')
            .setRequired(true)
    );

export async function execute(interaction) {
    const messageId = interaction.options.getString('message_id');
    const giveawayRecord = await getGiveawayByMessageId(interaction.client, messageId);

    if (!giveawayRecord) {
        return interaction.reply({
            content: '❌ Không tìm thấy dữ liệu Giveaway với Message ID đã cung cấp.',
            ephemeral: true
        });
    }

    const giveawayData = typeof giveawayRecord.data === 'string' 
        ? JSON.parse(giveawayRecord.data) 
        : giveawayRecord.data;

    // Build Ephemeral Dashboard Panel
    const panelEmbed = new EmbedBuilder()
        .setTitle('⚙️ Giveaway Control Panel')
        .setDescription(`Đang quản lý Giveaway ID: \`${messageId}\`\n**Phần thưởng:** ${giveawayData.prize}`)
        .setColor(0x5865F2)
        .addFields(
            { name: '📝 Title', value: giveawayData.title || giveawayData.prize, inline: true },
            { name: '🎨 Color', value: giveawayData.color || 'Default (#E91E63)', inline: true },
            { name: '🎁 Emoji', value: giveawayData.emoji || '🎁', inline: true },
            { name: '🖼️ Banner/Thumbnail', value: giveawayData.bannerUrl || giveawayData.thumbnailUrl ? 'Đã cài đặt' : 'Chưa cài', inline: true },
            { name: '⏱️ Timestamp', value: giveawayData.showTimestamp !== false ? 'Bật' : 'Tắt', inline: true }
        )
        .setFooter({ text: 'Chọn nút bên dưới để tùy chỉnh chi tiết.' });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`gw_edit_main_${messageId}`)
            .setLabel('Sửa Nội dung chính')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`gw_edit_media_${messageId}`)
            .setLabel('Sửa Ảnh & Footer')
            .setEmoji('🖼️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`gw_toggle_time_${messageId}`)
            .setLabel('Bật/Tắt Timestamp')
            .setEmoji('⏱️')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`gw_quick_end_${messageId}`)
            .setLabel('Kết thúc ngay')
            .setEmoji('🛑')
            .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
        embeds: [panelEmbed],
        components: [row1, row2],
        ephemeral: true
    });
}

// Handler lắng nghe Button Click & Modal Submit từ Dashboard
export async function handleDashboardInteraction(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    const { customId, client } = interaction;

    // --- 1. XỬ LÝ NÚT MỞ MODAL NỘI DUNG CHÍNH ---
    if (interaction.isButton() && customId.startsWith('gw_edit_main_')) {
        const messageId = customId.replace('gw_edit_main_', '');
        const giveawayRecord = await getGiveawayByMessageId(client, messageId);
        const data = typeof giveawayRecord?.data === 'string' ? JSON.parse(giveawayRecord.data) : giveawayRecord?.data;

        const modal = new ModalBuilder()
            .setCustomId(`modal_gw_main_${messageId}`)
            .setTitle('Chỉnh sửa Nội dung Giveaway');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Tiêu đề Giveaway (Title)')
            .setValue(data?.title || data?.prize || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const descInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Mô tả (Dùng {emoji},{prize},{endsAt},{host})')
            .setValue(data?.description || '')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Nhập nội dung mô tả tùy chỉnh...')
            .setRequired(false);

        const colorInput = new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Mã màu Hex (Ví dụ: #FF0055)')
            .setValue(data?.color || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const emojiInput = new TextInputBuilder()
            .setCustomId('emoji')
            .setLabel('Emoji tham gia (Ví dụ: 🎉)')
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

    // --- 2. XỬ LÝ NÚT MỞ MODAL HÌNH ẢNH & FOOTER ---
    if (interaction.isButton() && customId.startsWith('gw_edit_media_')) {
        const messageId = customId.replace('gw_edit_media_', '');
        const giveawayRecord = await getGiveawayByMessageId(client, messageId);
        const data = typeof giveawayRecord?.data === 'string' ? JSON.parse(giveawayRecord.data) : giveawayRecord?.data;

        const modal = new ModalBuilder()
            .setCustomId(`modal_gw_media_${messageId}`)
            .setTitle('Chỉnh sửa Hình ảnh & Footer');

        const bannerInput = new TextInputBuilder()
            .setCustomId('bannerUrl')
            .setLabel('URL Banner lớn (Image URL)')
            .setValue(data?.bannerUrl || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const thumbInput = new TextInputBuilder()
            .setCustomId('thumbnailUrl')
            .setLabel('URL Thumbnail góc phải (Thumbnail URL)')
            .setValue(data?.thumbnailUrl || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const footerTextInput = new TextInputBuilder()
            .setCustomId('footerText')
            .setLabel('Văn bản Footer (Dùng {winnerCount}, {entries})')
            .setValue(data?.footerText || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const footerIconInput = new TextInputBuilder()
            .setCustomId('footerIcon')
            .setLabel('URL Icon Footer (Icon URL)')
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

    // --- 3. XỬ LÝ BẬT/TẮT TIMESTAMP QUICK TOGGLE ---
    if (interaction.isButton() && customId.startsWith('gw_toggle_time_')) {
        const messageId = customId.replace('gw_toggle_time_', '');
        const giveawayRecord = await getGiveawayByMessageId(client, messageId);
        const data = typeof giveawayRecord?.data === 'string' ? JSON.parse(giveawayRecord.data) : giveawayRecord?.data;

        const currentStatus = data?.showTimestamp !== false;
        await editGiveawayDetails(client, messageId, { showTimestamp: !currentStatus });

        return interaction.reply({
            content: `✅ Đã ${!currentStatus ? 'bật' : 'tắt'} hiển thị Timestamp ở Footer!`,
            ephemeral: true
        });
    }

    // --- 4. SUBMIT MODAL NỘI DUNG CHÍNH ---
    if (interaction.isModalSubmit() && customId.startsWith('modal_gw_main_')) {
        const messageId = customId.replace('modal_gw_main_', '');

        const updates = {
            title: interaction.fields.getTextInputValue('title') || undefined,
            description: interaction.fields.getTextInputValue('description') || undefined,
            color: interaction.fields.getTextInputValue('color') || undefined,
            emoji: interaction.fields.getTextInputValue('emoji') || '🎁'
        };

        await editGiveawayDetails(client, messageId, updates);
        return interaction.reply({ content: '✅ Đã cập nhật thành công nội dung chính Giveaway!', ephemeral: true });
    }

    // --- 5. SUBMIT MODAL HÌNH ẢNH & FOOTER ---
    if (interaction.isModalSubmit() && customId.startsWith('modal_gw_media_')) {
        const messageId = customId.replace('modal_gw_media_', '');

        const updates = {
            bannerUrl: interaction.fields.getTextInputValue('bannerUrl') || undefined,
            thumbnailUrl: interaction.fields.getTextInputValue('thumbnailUrl') || undefined,
            footerText: interaction.fields.getTextInputValue('footerText') || undefined,
            footerIcon: interaction.fields.getTextInputValue('footerIcon') || undefined
        };

        await editGiveawayDetails(client, messageId, updates);
        return interaction.reply({ content: '✅ Đã cập nhật thành công Hình ảnh & Footer!', ephemeral: true });
    }
}
