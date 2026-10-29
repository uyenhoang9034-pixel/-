import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterBlackMarketService } from '../../services/witchHunterBlackMarketService.js';
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
    .setName('phat-manh-vo-ky-uc')
    .setDescription('Ban thưởng Mảnh Vỡ Ký Ức Chợ Đen Hư Không cho thành viên hoặc Admin (Chỉ Admin)')
    .addUserOption((opt) =>
      opt
        .setName('nguoi-nhan')
        .setDescription('Thành viên nhận Mảnh Vỡ Ký Ức (có thể chọn người dùng hoặc Admin)')
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('so-luong')
        .setDescription('Số lượng Mảnh Vỡ Ký Ức muốn ban thưởng (ví dụ: 100, 500, 1000...)')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('ly-do')
        .setDescription('Lý do ban thưởng (sự kiện, cống hiến, đền bù, quà Chợ Đen...)')
        .setRequired(false)
    ),

  aliases: ['phatmanhvokyuc'],
  category: 'Leveling',

  async execute(interaction) {
    try {
      // 1. Kiểm tra phân quyền: Chỉ Admin role 1541303749916754001 hoặc Owner
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này đâu nè vợ của Kim Nong ơi! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép phát Mảnh Vỡ Ký Ức thôi ạ 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const targetUser = interaction.options.getUser('nguoi-nhan', true);
      const amount = interaction.options.getInteger('so-luong', true);
      const reason = interaction.options.getString('ly-do') || 'Admin ban thưởng trực tiếp';

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // 2. Thực hiện ban thưởng Mảnh Vỡ Ký Ức qua Service
      const result = await WitchHunterBlackMarketService.awardMemoryShards(
        interaction.guild,
        targetUser.id,
        amount,
        {
          reason,
          executor: interaction.user,
          source: 'Lệnh /phat-manh-vo-ky-uc',
          notifyDM: true,
          notifyAdminLog: true,
        }
      );

      if (!result.success) {
        return interaction.editReply({
          content: `❌ Không thể phát Mảnh Vỡ Ký Ức: ${result.message || 'Lỗi không xác định'}`,
        });
      }

      const { emojis, colors, channels } = WITCH_HUNTER_CONFIG;
      const isWitch = result.faction === 'witch';
      const isHunter = result.faction === 'hunter';
      let factionDisplay = '*Chưa ký khế ước (Đã tích lũy sẵn vào hồ sơ)*';
      if (isWitch) factionDisplay = `${emojis.witchBadge} **Hội Phù Thủy (Witches)**`;
      if (isHunter) factionDisplay = `${emojis.hunterBadge} **Hiệp Hội Thợ Săn (W.H. Association)**`;

      // 3. Tạo Embed phản hồi hoàn tất cho Admin
      const replyEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple) // Màu tím pastel nhạt nhạt cố định
        .setTitle(`${emojis.titleLeft} **PHÁT MẢNH VỠ KÝ ỨC THÀNH CÔNG** ${emojis.titleRight}`)
        .setDescription(
          `Vợ của Kim Nong ơi, em bot Usagi múp rụp đã phát Mảnh Vỡ Ký Ức thành công rồi nè! 💕\n\n` +
          `👤 **Người nhận:** <@${targetUser.id}> (\`${targetUser.tag}\` | ID: \`${targetUser.id}\`)\n` +
          `👑 **Người ban thưởng:** <@${interaction.user.id}>\n` +
          `<a:trangtrig46:1547240249761996812> **Số lượng phát:** **+${amount.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812> Mảnh Vỡ Ký Ức\n` +
          `📊 **Số dư Mảnh Vỡ:** ${result.oldShards.toLocaleString('vi-VN')} ➡️ **${result.newShards.toLocaleString('vi-VN')}** Mảnh\n` +
          `⚔️ **Phe phái:** ${factionDisplay}\n` +
          `\n📝 **Lý do:** ${reason}\n\n` +
          `*✨ Hệ thống đã gửi tin nhắn riêng (DM) tới người nhận và lưu nhật ký vào kênh Admin <#${channels.adminLogChannelId}>.*`
        )
        .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' })
        .setTimestamp();

      return interaction.editReply({
        embeds: [replyEmbed],
      });
    } catch (error) {
      logger.error('❌ [WitchHunterBlackMarket] Lỗi khi thực hiện lệnh /phat-manh-vo-ky-uc:', error);
      const errorMessage = `Đã xảy ra lỗi khi phát Mảnh Vỡ Ký Ức: ${error.message}`;
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: errorMessage }).catch(() => null);
      }
      return interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  },
};

