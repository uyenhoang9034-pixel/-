import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG, formatRankEmoji } from '../../config/witchHunterConfig.js';
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
    .setDescription('[Admin] Xem trước Bảng Xếp Hạng Level (Chat + Voice) Top 20 để chuẩn bị chốt tháng')
    .addStringOption((opt) =>
      opt
        .setName('chu-ky')
        .setDescription('Chọn chu kỳ BXH muốn xem trước (Mặc định: Tự động phân chia tháng trước / tháng này)')
        .setRequired(false)
        .addChoices(
          { name: 'Tháng trước (Đang chờ chốt sổ)', value: 'thang_truoc' },
          { name: 'Tháng này (Chu kỳ hiện tại)', value: 'thang_nay' }
        )
    ),

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
      const guild = interaction.guild;
      const chosenMode = interaction.options.getString('chu-ky');
      let cycleMode = 'auto';
      if (chosenMode === 'thang_truoc') cycleMode = 'previous';
      if (chosenMode === 'thang_nay') cycleMode = 'current';

      // 2. CHỈ SỬ DỤNG DUY NHẤT: Dữ liệu tổng hợp từ Báo Cáo Hoạt Động Hằng Ngày (pumpkinGrowthTracker)
      let result = null;

      try {
        const { pumpkinGrowthTracker } = await import('../../services/pumpkinGrowthTracker.js');
        result = await pumpkinGrowthTracker.getMonthlyLeaderboard({ cycleMode, client: botClient });
      } catch (e) {
        logger.error('❌ [WitchHunter] Lỗi khi lấy monthly leaderboard từ pumpkinGrowthTracker:', e);
      }

      const leaderboard = result?.leaderboard || [];
      const displayName = result?.displayName || 'Tháng hiện tại';
      const isPendingView = result?.isPendingView || false;
      const isPreviousPending = result?.isPreviousPending || false;

      if (!leaderboard || leaderboard.length === 0) {
        const notice = isPendingView
          ? `⚠️ Hiện tại chưa có dữ liệu báo cáo hằng ngày nào của **${displayName}** (đang chờ chốt sổ).`
          : `⚠️ Hiện tại chưa có dữ liệu báo cáo hằng ngày nào của **${displayName}** (tính từ 00:00 ngày 24 đến nay).`;
        return interaction.editReply({
          content: notice,
        });
      }

      const { emojis, colors } = WITCH_HUNTER_CONFIG;

      const top1_3 = leaderboard.slice(0, 3);
      const top4_10 = leaderboard.slice(3, 10);
      const top11_20 = leaderboard.slice(10, 20);

      const formatGroup = async (items, startRank) => {
        if (!items || items.length === 0) return '*Chưa có thành viên đạt mốc này*';
        const formatted = await Promise.all(
          items.map(async (item, idx) => {
            const rank = startRank + idx;
            let profile = WitchHunterService.getUserProfile(item.userId);
            let faction = profile?.faction;

            // Nếu database chưa kịp lưu phe, đối chiếu trực tiếp từ Role trên Server Discord
            if (!faction && guild) {
              const guildMember =
                guild.members.cache.get(item.userId) || (await guild.members.fetch(item.userId).catch(() => null));

              if (guildMember?.roles?.cache) {
                for (const rId of Object.values(WITCH_HUNTER_CONFIG.roles.hunter)) {
                  if (guildMember.roles.cache.has(rId)) {
                    faction = 'hunter';
                    break;
                  }
                }
                if (!faction) {
                  for (const rId of Object.values(WITCH_HUNTER_CONFIG.roles.witch)) {
                    if (guildMember.roles.cache.has(rId)) {
                      faction = 'witch';
                      break;
                    }
                  }
                }

                // Tự động đồng bộ và lưu vào Database để tối ưu cho các lần gọi sau
                if (faction) {
                  if (!profile) {
                    profile = { user_id: item.userId, faction, current_rank: 1, pumpkins: 0, unlocked_supporters: [] };
                  } else {
                    profile.faction = faction;
                  }
                  const { witchHunterStorage } = await import('../../services/witchHunterService.js');
                  witchHunterStorage.saveUser(profile);
                }
              }
            }

            const factionTag = faction
              ? faction === 'hunter'
                ? `[${emojis.hunterButton} Thợ Săn]`
                : `[${emojis.witchButton} Phù Thủy]`
              : `*(Chưa chọn phe)*`;

            return (
              `${formatRankEmoji(rank)} <@${item.userId}> ${factionTag}\n` +
              `> ⭐ **+${item.totalLevels} Cấp Ma Thuật Tháng**\n` +
              `> 🎙️ Voice: \`${(item.voiceMinutes || 0).toLocaleString('vi-VN')}p\` (+${item.voiceLevels || 0}) • 💬 Chat: \`${(item.messageCount || 0).toLocaleString('vi-VN')} tin\` (+${item.chatLevels || 0})`
            );
          })
        );
        return formatted.join('\n\n');
      };

      const top1_3Formatted = await formatGroup(top1_3, 1);
      const top4_10Formatted = await formatGroup(top4_10, 4);
      const top11_20Formatted = await formatGroup(top11_20, 11);

      let cycleStatusLine = `Chu kỳ: **${displayName}**`;
      if (isPendingView) {
        cycleStatusLine += ` *(Đang chờ chốt sổ mốc 00:00 ngày 24)*`;
      } else {
        cycleStatusLine += ` *(Đang diễn ra từ 00:00 ngày 24)*`;
      }

      let hintLine = '';
      if (isPreviousPending && cycleMode !== 'current') {
        hintLine = `> 💡 *Tháng trước đang chờ chốt sổ. Bạn có thể chọn \`/preview-bxh chu-ky: Tháng này\` để xem số liệu chu kỳ mới.*\n`;
      } else if (cycleMode === 'current') {
        hintLine = `> 💡 *Đang xem chu kỳ mới. Chọn \`/preview-bxh chu-ky: Tháng trước\` nếu cần xem lại chu kỳ chờ chốt.*\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple) // Cố định tím pastel nhạt nhạt
        .setTitle(`${emojis.titleLeft} 𝓟𝓻𝓮𝓿𝓲𝓮𝔀 𝓑𝓪̉𝓷𝓰 𝓧𝓮̂́𝓹 𝓗𝓪̣𝓷𝓰 𝓛𝓮𝓿𝓮𝓵 𝓣𝓱𝓪́𝓷𝓰 ${emojis.titleRight}`)
        .setDescription(
          `Dưới đây là kết quả **Top 20 thành viên có mức tăng trưởng Cấp Ma Thuật cao nhất** (${cycleStatusLine}):\n` +
            `*(Dữ liệu tổng hợp từ toàn bộ các Báo Cáo Hoạt Động Hằng Ngày, ẩn ở chế độ xem trước dành riêng cho Admin)*\n` +
            hintLine +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .addFields(
          {
            name: `${emojis.linhtoc || '<a:linhtocg:1563399670351536310>'} **TOP 1 - 3 (+100 Bí Ngô ${emojis.pumpkin}):**`,
            value: top1_3Formatted,
            inline: false,
          },
          {
            name: `⚔️ **TOP 4 - 10 (+50 Bí Ngô ${emojis.pumpkin}):**`,
            value: top4_10Formatted,
            inline: false,
          },
          {
            name: `🔮 **TOP 11 - 20 (+25 Bí Ngô ${emojis.pumpkin}):**`,
            value: top11_20Formatted,
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

      embed
        .setFooter({
          text: 'Witch Hunter Preview • Chỉ hiển thị cho riêng Admin',
        })
        .setTimestamp();

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
