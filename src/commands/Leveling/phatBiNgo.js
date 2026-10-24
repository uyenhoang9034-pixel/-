import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterService } from '../../services/witchHunterService.js';
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
    .setName('phat-bi-ngo')
    .setDescription('Ban thưởng Bí Ngô Witch Hunter cho thành viên hoặc Admin (Chỉ Admin)')
    .addUserOption((opt) =>
      opt
        .setName('nguoi-nhan')
        .setDescription('Thành viên nhận Bí Ngô (có thể chọn người dùng hoặc Admin)')
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('so-luong')
        .setDescription('Số lượng Bí Ngô muốn ban thưởng (ví dụ: 10, 50, 100, 500...)')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('ly-do')
        .setDescription('Lý do ban thưởng (nhiệm vụ, sự kiện đua top, cống hiến...)')
        .setRequired(false)
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      // 1. Kiểm tra phân quyền: Chỉ Admin role 1541303749916754001 hoặc Owner
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này đâu nè vợ của Kim Nong ơi! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép phát Bí Ngô thôi ạ 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const targetUser = interaction.options.getUser('nguoi-nhan', true);
      const amount = interaction.options.getInteger('so-luong', true);
      const reason = interaction.options.getString('ly-do') || 'Admin ban thưởng trực tiếp';

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // 2. Thực hiện ban thưởng Bí Ngô qua Service
      const result = await WitchHunterService.awardPumpkins(
        interaction.guild,
        targetUser.id,
        amount,
        {
          reason,
          executor: interaction.user,
          source: 'Lệnh /phat-bi-ngo',
          notifyDM: true,
          notifyAdminLog: true,
        }
      );

      if (!result.success) {
        return interaction.editReply({
          content: `❌ Không thể phát Bí Ngô: ${result.message || 'Lỗi không xác định'}`,
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
        .setTitle(`${emojis.titleLeft} 𝓟𝓱𝓪́𝓽 𝓑𝓲́ 𝓝𝓰𝓸̂ 𝓣𝓱𝓪̀𝓷𝓱 𝓒𝓸̂𝓷𝓰 ${emojis.titleRight}`)
        .setDescription(
          `Vợ của Kim Nong ơi, em bot Usagi múp rụp đã phát Bí Ngô thành công rồi nè! 💕\n\n` +
          `👤 **Người nhận:** <@${targetUser.id}> (\`${targetUser.tag}\` | ID: \`${targetUser.id}\`)\n` +
          `👑 **Người ban thưởng:** <@${interaction.user.id}>\n` +
          `${emojis.pumpkin} **Số lượng phát:** **+${amount.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
          `📊 **Số dư Bí Ngô:** ${result.oldPumpkins.toLocaleString('vi-VN')} ➡️ **${result.newPumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
          `⚔️ **Phe phái:** ${factionDisplay}\n` +
          `🎖️ **Cấp bậc hiện tại:** ${result.faction ? `**${result.rankInfo?.name || `Bậc ${result.newRank}`}** *(Bậc ${result.newRank})*` : '*Chưa phân định (Sẽ tính thẳng rank khi chọn phe)*'}\n` +
          (result.isRankUp ? `\n🎉 **ĐỘT PHÁ DANH VỊ:** Thành viên đã tích lũy đủ điểm thăng cấp lên **${result.rankInfo.name}** và được cấp Role mới tự động!\n` : '') +
          `\n📝 **Lý do:** ${reason}\n\n` +
          `*✨ Hệ thống đã gửi tin nhắn riêng (DM) tới người nhận và lưu nhật ký vào kênh Admin <#${channels.adminLogChannelId}>.*`
        )
        .setFooter({ text: 'Witch Hunter System' })
        .setTimestamp();

      return interaction.editReply({
        embeds: [replyEmbed],
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi khi thực hiện lệnh /phat-bi-ngo:', error);
      const errorMessage = `Đã xảy ra lỗi khi phát Bí Ngô: ${error.message}`;
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: errorMessage }).catch(() => null);
      }
      return interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  },
};
