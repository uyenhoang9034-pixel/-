import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG, formatRankEmoji } from '../../config/witchHunterConfig.js';
import { WitchHunterService } from '../../services/witchHunterService.js';
import { logger } from '../../utils/logger.js';

function safeAddChunkedFields(embed, title, fullText, inline = false) {
  if (!fullText || typeof fullText !== 'string' || fullText.trim().length === 0) {
    embed.addFields({
      name: title.slice(0, 256),
      value: '*Không có thành viên*',
      inline,
    });
    return;
  }

  const lines = fullText.split('\n');
  let currentChunk = '';
  let partIndex = 1;

  for (const line of lines) {
    const safeLine = line.length > 1000 ? line.slice(0, 1000) + '...' : line;
    if (currentChunk.length + safeLine.length + 1 > 1000) {
      if (currentChunk.trim().length > 0) {
        embed.addFields({
          name: (partIndex === 1 ? title : `${title} (Tiếp theo)`).slice(0, 256),
          value: currentChunk.trim().slice(0, 1024),
          inline,
        });
        partIndex++;
      }
      currentChunk = safeLine + '\n';
    } else {
      currentChunk += safeLine + '\n';
    }
  }

  if (currentChunk.trim().length > 0) {
    embed.addFields({
      name: (partIndex === 1 ? title : `${title} (Tiếp theo)`).slice(0, 256),
      value: currentChunk.trim().slice(0, 1024),
      inline,
    });
  }
}

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
    .setName('chot-bxh')
    .setDescription('Chốt Bảng Xếp Hạng tháng và phát thưởng Bí Ngô thăng cấp (Chỉ Admin)')
    .setDefaultMemberPermissions(0n)
    .setDMPermission(false)
    .addStringOption((opt) =>
      opt
        .setName('thang')
        .setDescription('Tên tháng tổng kết (Ví dụ: Tháng 10/2026 hoặc Tháng 11/2026)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('top_1_3')
        .setDescription('Danh sách mention/ID Top 1-3 (để trống nếu muốn bot tự động lấy từ Báo Cáo Daily Bí Ngô)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('top_4_10')
        .setDescription('Danh sách mention/ID Top 4-10 (để trống nếu muốn bot tự động lấy từ Báo Cáo Daily Bí Ngô)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('top_11_20')
        .setDescription('Danh sách mention/ID Top 11-20 (để trống nếu muốn bot tự động lấy từ Báo Cáo Daily Bí Ngô)')
        .setRequired(false)
    ),

  category: 'Leveling',

  async execute(interaction, nullArg, client) {
    try {
      // 1. Kiểm tra quyền Admin (Role 1541303749916754001 hoặc Owner)
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này đâu nè vợ của Kim Nong ơi! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép chốt BXH tháng thôi ạ 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const thang = interaction.options.getString('thang', true);
      let top1_3Raw = interaction.options.getString('top_1_3') || '';
      let top4_10Raw = interaction.options.getString('top_4_10') || '';
      let top11_20Raw = interaction.options.getString('top_11_20') || '';

      const guild = interaction.guild;
      const botClient = client || interaction.client;

      let targetCycleKey = null;

      // Phân tích tên tháng để tìm cycleKey tương ứng (ví dụ: "Tháng 11/2026", "11/2026", "Tháng 11", "2026-11", "12", "Tháng 12")
      const resolveCycleKey = (input) => {
        if (!input) return null;
        const trimmed = input.trim();
        const matchFull = trimmed.match(/(\d{1,2})[\/\-](\d{4})/);
        if (matchFull) {
          return `${matchFull[2]}-${String(matchFull[1]).padStart(2, '0')}`;
        }
        const matchIso = trimmed.match(/(\d{4})[\/\-](\d{1,2})/);
        if (matchIso) {
          return `${matchIso[1]}-${String(matchIso[2]).padStart(2, '0')}`;
        }
        const matchMonth = trimmed.match(/(?:tháng\s*|thang\s*|t\s*)(\d{1,2})/i);
        if (matchMonth) {
          const m = parseInt(matchMonth[1], 10);
          const now = new Date();
          const currentMonth = now.getMonth() + 1;
          const year = (m > currentMonth + 1) ? now.getFullYear() - 1 : now.getFullYear();
          return `${year}-${String(m).padStart(2, '0')}`;
        }
        const matchJustNum = trimmed.match(/^(\d{1,2})$/);
        if (matchJustNum) {
          const m = parseInt(matchJustNum[1], 10);
          const now = new Date();
          const currentMonth = now.getMonth() + 1;
          const year = (m > currentMonth + 1) ? now.getFullYear() - 1 : now.getFullYear();
          return `${year}-${String(m).padStart(2, '0')}`;
        }
        return null;
      };

      const requestedCycleKey = resolveCycleKey(thang);

      // Nếu không nhập thủ công, tự động lấy từ hệ thống tăng trưởng tháng (tổng hợp từ Báo Cáo Daily Bí Ngô)
      if (!top1_3Raw) {
        try {
          const { pumpkinGrowthTracker } = await import('../../services/pumpkinGrowthTracker.js');
          let lbResult = await pumpkinGrowthTracker.getMonthlyLeaderboard({
            cycleKey: requestedCycleKey,
            cycleMode: 'auto',
            client: botClient,
          });

          // Fallback: Nếu chu kỳ requestedCycleKey không có dữ liệu, thử fallback sang chu kỳ auto (đang chờ chốt)
          if ((!lbResult?.leaderboard || lbResult.leaderboard.length === 0) && requestedCycleKey) {
            lbResult = await pumpkinGrowthTracker.getMonthlyLeaderboard({
              cycleMode: 'auto',
              client: botClient,
            });
          }

          targetCycleKey = lbResult?.targetCycleKey;
          const monthlyLb = lbResult?.leaderboard || [];
          if (monthlyLb && monthlyLb.length > 0) {
            top1_3Raw = monthlyLb.slice(0, 3).map((u) => u.userId).join(' ');
            top4_10Raw = monthlyLb.slice(3, 10).map((u) => u.userId).join(' ');
            top11_20Raw = monthlyLb.slice(10, 20).map((u) => u.userId).join(' ');
          }
        } catch (e) {
          logger.error('❌ [WitchHunter] Lỗi khi lấy auto lb từ pumpkinGrowthTracker:', e);
        }
      }

      if (!top1_3Raw) {
        return interaction.editReply({
          content: '⚠️ Không tìm thấy danh sách thành viên hợp lệ từ hệ thống Báo Cáo Daily Bí Ngô (Witch Hunter). Vợ của Kim Nong có thể điền danh sách thủ công vào các tùy chọn của lệnh hoặc kiểm tra lại kênh Báo Cáo Daily nha! 💕',
        });
      }

      // 2. Xử lý qua Service: Lưu điểm, DM người chưa chọn phe, kiểm tra thăng cấp & đổi role
      const results = await WitchHunterService.processMonthlyLeaderboard(guild, botClient, {
        top1_3Raw,
        top4_10Raw,
        top11_20Raw,
        thang,
      });

      const { emojis, colors, channels } = WITCH_HUNTER_CONFIG;

      const formatUserList = (items, startRank = 1) => {
        if (!items || items.length === 0) return '*Không có thành viên*';
        return items
          .map((item, idx) => {
            const rank = startRank + idx;
            const factionTag = item.faction
              ? item.faction === 'hunter'
                ? `[<a:trangtrig36:1563065680922808340> Thợ Săn]`
                : `[<a:trangtrig32:1546906170994856026> Phù Thủy]`
              : `*(Chưa chọn phe)*`;
            return `${formatRankEmoji(rank)} <@${item.userId}> ${factionTag}`;
          })
          .join('\n');
      };

      const linhtocEmoji = emojis.linhtoc || '<a:linhtocg:1563399670351536310>';

      let fullDescription =
        `Trải qua những ngày đêm rèn luyện ma thuật và giao chiến khốc liệt, Bảng Xếp Hạng vinh quang **${thang}** đã chính thức khép lại!\n` +
        `Hội Đồng Tối Cao xin trân trọng trao tặng tinh hoa Bí Ngô ${emojis.pumpkin} cho những bậc kỳ tài xuất sắc nhất:\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${linhtocEmoji} **TOP 1 - 3 THÁNG (+100 Bí Ngô ${emojis.pumpkin}):**\n` +
        `${formatUserList(results.top1_3, 1)}\n\n`;

      if (results.top4_10.length > 0) {
        fullDescription +=
          `${linhtocEmoji} **TOP 4 - 10 THÁNG (+50 Bí Ngô ${emojis.pumpkin}):**\n` +
          `${formatUserList(results.top4_10, 4)}\n\n`;
      }

      if (results.top11_20.length > 0) {
        fullDescription +=
          `${linhtocEmoji} **TOP 11 - 20 THÁNG (+25 Bí Ngô ${emojis.pumpkin}):**\n` +
          `${formatUserList(results.top11_20, 11)}\n\n`;
      }

      if (results.dmReminded.length > 0) {
        fullDescription +=
          `<a:trangtrig49:1567818140375851018> **Lưu ý**:\n` +
          `- Hiện có **${results.dmReminded.length}** thành viên trong danh sách chưa chọn phe. Em Phù Thủy Usagi đã gửi thư riêng (qua dm) cho từng Lữ Khách rồi nha.\n` +
          `- Các Lữ Khách mau chóng ghé qua kênh <#${channels.selectionChannelId}> để ký khế ước nhận role nhé!\n\n`;
      }

      // 3. Xây dựng Embed Vinh Danh Hoàng Kim (Màu tím pastel nhạt nhạt cố định)
      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple) // Cố định màu tím pastel nhạt nhạt
        .setTitle(`${emojis.titleLeft} **VINH DANH BẢNG XẾP HẠNG MA THUẬT - ${thang.toUpperCase()}** ${emojis.titleRight}`)
        .setDescription(fullDescription.trim());

      // Đánh dấu đặc biệt những thành viên THĂNG CẤP VƯỢT BẬC kèm câu thoại chuẩn
      if (results.rankUps.length > 0) {
        const rankUpLines = results.rankUps.map((r) => r.quote).join('\n\n');
        safeAddChunkedFields(
          embed,
          `✨ DANH SÁCH THĂNG CẤP VƯỢT BẬC KỲ NÀY:`,
          rankUpLines,
          false
        );
      }

      embed
        .setFooter({
          text: 'Witch Hunter System',
        })
        .setTimestamp();

      // 4. Gửi vào Kênh ID 1563457814138064916
      const announcementChannel = guild.channels.cache.get(channels.announcementChannelId) || interaction.channel;
      if (announcementChannel) {
        await announcementChannel.send({ embeds: [embed] });
      }

      // 5. Lưu trữ log tháng cũ, đánh dấu chu kỳ hoàn thành & xóa các bản ghi của tháng đã chốt
      try {
        const { pumpkinGrowthTracker } = await import('../../services/pumpkinGrowthTracker.js');
        await pumpkinGrowthTracker.archiveAndCloseCycle(targetCycleKey, thang);
      } catch (archiveErr) {
        logger.error('⚠️ [WitchHunter] Lỗi khi lưu trữ log tháng:', archiveErr);
      }

      return interaction.editReply({
        content: `✅ Em bot Usagi múp rụp đã chốt BXH **${thang}** thành công, gửi thông báo vinh danh tới kênh <#${announcementChannel?.id || channels.announcementChannelId}> và dọn dẹp bộ nhớ log tháng sẵn sàng cho tháng mới rồi nè vợ của Kim Nong ơi! 💕`,
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi lệnh chot-bxh:', error);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: `Đã có lỗi xảy ra khi chốt bảng xếp hạng: ${error.message}`,
        });
      }
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
