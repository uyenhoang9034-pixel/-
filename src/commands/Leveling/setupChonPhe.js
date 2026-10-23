import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { logger } from '../../utils/logger.js';

function isWitchHunterAdmin(interaction) {
  const member = interaction.member;
  if (!member) return false;

  const ownerId = interaction.guild?.ownerId;
  if (ownerId && (interaction.user?.id === ownerId || member.id === ownerId)) {
    return true;
  }

  const configuredOwnerIds = (process.env.OWNER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (configuredOwnerIds.includes(interaction.user?.id) || configuredOwnerIds.includes(member.id)) {
    return true;
  }

  const adminRole = WITCH_HUNTER_CONFIG.adminRoleId;
  if (member.roles?.cache?.has?.(adminRole)) return true;
  if (Array.isArray(member._roles) && member._roles.includes(adminRole)) return true;
  if (Array.isArray(member.roles) && member.roles.includes(adminRole)) return true;

  return false;
}

export default {
  data: new SlashCommandBuilder()
    .setName('setup-chon-phe')
    .setDescription('Tạo hộp thoại ký kết khế ước chọn phe Witch Hunter (Chỉ Admin)'),

  category: 'Leveling',

  async execute(interaction) {
    try {
      // 1. Kiểm tra phân quyền Admin (Role ID 1541303749916754001 hoặc Owner)
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này đâu nè vợ của Kim Nong ơi! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép tạo bảng chọn phe ạ 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const { emojis, colors, channels } = WITCH_HUNTER_CONFIG;

      // 2. Xác định kênh hiển thị: Hộp thoại cố định xuất hiện ở kênh 1563069959658143894
      const targetChannelId = channels.selectionChannelId;
      const targetChannel = interaction.guild.channels.cache.get(targetChannelId) || interaction.channel;

      if (!targetChannel) {
        return interaction.reply({
          content: `❌ Không tìm thấy kênh chỉ định (<#${targetChannelId}>) để tạo hộp thoại chọn phe!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // 3. Tạo Embed phong cách ma mị với màu tím pastel nhạt nhạt cố định
      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple) // Cố định tím pastel nhạt nhạt
        .setTitle(`${emojis.titleLeft} 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓣𝓱𝓮̂́ 𝓖𝓲𝓸̛́𝓲 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽: 𝓦𝓲𝓽𝓬𝓱 𝓗𝓾𝓷𝓽𝓮𝓻 ${emojis.titleRight}`)
        .setDescription(
          `Vòng xoay định mệnh giữa hai thế lực ngàn năm lại một lần nữa mở ra...\n` +
          `Trước mắt bạn là bản **Khế Ước Cổ Đại**. Hãy chọn 1 trong 2 phe để tham chiến và dấn thân vào con đường tranh đoạt vinh quang ma thuật!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `⚔️ **PHE THỢ SĂN (W.H. ASSOCIATION):**\n` +
          `> Những chiến binh quả cảm tôi luyện ý chí sắt đá, săn lùng và phong ấn hắc ma thuật. Tích lũy chiến công Bí Ngô để từng bước thăng cấp từ **C-Rank Hunter** lên huyền thoại **SS-Rank Hunter**!\n\n` +
          `🔮 **PHE PHÙ THỦY (WITCHES):**\n` +
          `> Những bậc thầy cổ thuật bí ẩn, thao túng bóng đêm và bùa chú cấm kỵ. Khởi đầu từ một **Apprentice Witch**, tích lũy tinh hoa Bí Ngô để thức tỉnh thành **Great Witch** tối cao!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📜 **5 BẬC CẤP BẬC & MỐC BÍ NGÔ TÍCH LŨY:**\n` +
          `• **Bậc 1 (0 ${emojis.pumpkin}):** C-Rank Hunter | Apprentice Witch\n` +
          `• **Bậc 2 (100 ${emojis.pumpkin}):** B-Rank Hunter | Coven Witch\n` +
          `• **Bậc 3 (500 ${emojis.pumpkin}):** A-Rank Hunter | High Witch\n` +
          `• **Bậc 4 (3.000 ${emojis.pumpkin}):** S-Rank Hunter | Archwitch\n` +
          `• **Bậc 5 (10.000 ${emojis.pumpkin}):** SS-Rank Hunter | Great Witch\n\n` +
          `⚠️ **LƯU Ý:** Một khi đã chọn phe, khế ước sẽ được phong ấn vĩnh viễn và bạn **không thể đổi phe**!`
        )
        .setFooter({
          text: 'Nhấn vào nút bên dưới để chính thức ký kết khế ước • Em bot Usagi múp rụp 💕',
        })
        .setTimestamp();

      // 4. Gắn 2 nút bấm theo đúng yêu cầu:
      // Nút 1: Gia nhập Hiệp Hội Thợ Săn (Style: Secondary - Xám)
      // Nút 2: Quy phục Hội Phù Thủy (Style: Primary - Xanh biển)
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('witch_hunter_join:hunter')
          .setLabel('Gia nhập Hiệp Hội Thợ Săn')
          .setEmoji(emojis.hunterButton)
          .setStyle(ButtonStyle.Secondary), // Màu xám

        new ButtonBuilder()
          .setCustomId('witch_hunter_join:witch')
          .setLabel('Quy phục Hội Phù Thủy')
          .setEmoji(emojis.witchButton)
          .setStyle(ButtonStyle.Primary) // Màu xanh biển
      );

      // Gửi hộp thoại vào đúng kênh 1563069959658143894
      await targetChannel.send({
        embeds: [embed],
        components: [row],
      });

      return interaction.reply({
        content: `✅ Em bot Usagi múp rụp đã thiết lập bảng chọn phe Witch Hunter tại kênh <#${targetChannel.id}> thành công rồi nè vợ của Kim Nong ơi! 💕`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi lệnh setup-chon-phe:', error);
      return interaction.reply({
        content: `Đã xảy ra lỗi khi tạo bảng chọn phe: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
