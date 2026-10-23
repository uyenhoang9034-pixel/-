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
    .setName('preview-bxh')
    .setDescription('[Admin] Xem trước Bảng Xếp Hạng Level (Chat + Voice) Top 20 để chuẩn bị chốt tháng'),

  category: 'Leveling',

  async execute(interaction, nullArg, client) {
    try {
      // 1. Phân quyền: Chỉ Role Admin 1541303749916754001 hoặc Chủ server
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này đâu nè vợ của Kim Nong ơi! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép xem trước BXH thôi ạ 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const botClient = client || interaction.client;
      const guildId = interaction.guildId;

      // 2. TỐI ƯU RAM: Đọc dữ liệu tổng hợp tháng từ pumpkinGrowthTracker (Stream JSONL)
      let isMonthlyGrowth = true;
      let leaderboard = [];

      try {
        const { pumpkinGrowthTracker } = await import('../../services/pumpkinGrowthTracker.js');
        leaderboard = await pumpkinGrowthTracker.getMonthlyLeaderboard();
      } catch (e) {
        logger.error('❌ [WitchHunter] Lỗi khi lấy monthly leaderboard:', e);
      }

      // Fallback: Nếu đầu tháng chưa có ai tích lũy trong log tháng, đọc từ BXH Leveling tổng
      if (!leaderboard || leaderboard.length === 0) {
        isMonthlyGrowth = false;
        try {
          const { getLeaderboard: getDbLeaderboard } = await import('../../utils/database.js');
          leaderboard = await getDbLeaderboard(botClient, guildId, 20);
        } catch (e) {
          // Fallback tiếp
        }

        if (!leaderboard || leaderboard.length === 0) {
          const { getLeaderboard: getServiceLeaderboard } = await import('../../services/leveling/leveling.js');
          leaderboard = await getServiceLeaderboard(botClient, guildId, 20);
        }
      }

      if (!leaderboard || leaderboard.length === 0) {
        return interaction.editReply({
          content: '⚠️ Hiện tại chưa có dữ liệu hoạt động (Chat / Voice) nào trong hệ thống Leveling của server để hiển thị.',
        });
      }

      const { emojis, colors } = WITCH_HUNTER_CONFIG;

      const top1_3 = leaderboard.slice(0, 3);
      const top4_10 = leaderboard.slice(3, 10);
      const top11_20 = leaderboard.slice(10, 20);

      const formatGroup = (items, startRank) => {
        if (!items || items.length === 0) return '*Chưa có thành viên đạt mốc này*';
        return items
          .map((item, idx) => {
            const rank = startRank + idx;
            const profile = WitchHunterService.getUserProfile(item.userId);
            const factionTag = profile?.faction
              ? profile.faction === 'hunter'
                ? `[${emojis.hunterButton} Thợ Săn]`
                : `[${emojis.witchButton} Phù Thủy]`
              : `*(Chưa chọn phe)*`;

            if (isMonthlyGrowth) {
              return (
                `**#${rank}.** <@${item.userId}> ${factionTag}\n` +
                `> ⭐ **+${item.totalLevels} Cấp Ma Thuật Tháng**\n` +
                `> 🎙️ Voice: \`${(item.voiceMinutes || 0).toLocaleString('vi-VN')}p\` (+${item.voiceLevels || 0}) • 💬 Chat: \`${(item.messageCount || 0).toLocaleString('vi-VN')} tin\` (+${item.chatLevels || 0})`
              );
            }

            return (
              `**#${rank}.** <@${item.userId}> ${factionTag}\n` +
              `> 🎖️ Lv.**${item.level || 0}** • Tổng XP: **${(item.totalXp || 0).toLocaleString('vi-VN')}**`
            );
          })
          .join('\n\n');
      };

      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple) // Cố định tím pastel nhạt nhạt
        .setTitle(`${emojis.titleLeft} 𝓟𝓻𝓮𝓿𝓲𝓮𝔀 𝓑𝓪̉𝓷𝓰 𝓧𝓮̂́𝓹 𝓗𝓪̣𝓷𝓰 𝓛𝓮𝓿𝓮𝓵 𝓣𝓱𝓪́𝓷𝓰 ${emojis.titleRight}`)
        .setDescription(
          isMonthlyGrowth
            ? `Dưới đây là kết quả **Top 20 thành viên có mức tăng trưởng Cấp Ma Thuật cao nhất trong tháng** (tính theo cấp thực tế tăng từ Voice 30p = +1 cấp và Chat theo hệ thống Tu Tiên Leveling):\n` +
              `*(Bảng này hiển thị ẩn ở chế độ xem trước, chỉ có Admin mới nhìn thấy)*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
            : `Dưới đây là kết quả **Top 20 thành viên tích cực nhất** từ hệ thống Tu Tiên Leveling (chế độ dự phòng do log tháng chưa có dữ liệu tích lũy):\n` +
              `*(Bảng này hiển thị ẩn ở chế độ xem trước, chỉ có Admin mới nhìn thấy)*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .addFields(
          {
            name: `🏆 TOP 1 - 3 (+100 Bí Ngô ${emojis.pumpkin}):`,
            value: formatGroup(top1_3, 1),
            inline: false,
          },
          {
            name: `⚔️ TOP 4 - 10 (+50 Bí Ngô ${emojis.pumpkin}):`,
            value: formatGroup(top4_10, 4),
            inline: false,
          },
          {
            name: `🔮 TOP 11 - 20 (+25 Bí Ngô ${emojis.pumpkin}):`,
            value: formatGroup(top11_20, 11),
            inline: false,
          }
        );

      // Chuỗi Mentions để Admin copy nhanh vào lệnh /chot-bxh
      const top1_3Mentions = top1_3.map((u) => `<@${u.userId}>`).join(' ') || 'Không có';
      const top4_10Mentions = top4_10.map((u) => `<@${u.userId}>`).join(' ') || 'Không có';
      const top11_20Mentions = top11_20.map((u) => `<@${u.userId}>`).join(' ') || 'Không có';

      embed.addFields({
        name: `📋 MENTIONS ĐỂ COPY NHANH VÀO LỆNH /chot-bxh:`,
        value:
          `**top_1_3:**\n\`${top1_3Mentions}\`\n\n` +
          `**top_4_10:**\n\`${top4_10Mentions}\`\n\n` +
          `**top_11_20:**\n\`${top11_20Mentions}\``,
        inline: false,
      });

      embed.setFooter({
        text: 'Witch Hunter Preview • Chỉ hiển thị cho riêng Admin • Em bot Usagi múp rụp 💕',
      }).setTimestamp();

      return interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi lệnh preview-bxh:', error);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: `Đã có lỗi xảy ra khi xem trước BXH: ${error.message}`,
        });
      }
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
