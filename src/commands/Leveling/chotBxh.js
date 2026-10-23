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
    .setName('chot-bxh')
    .setDescription('Chốt Bảng Xếp Hạng tháng và phát thưởng Bí Ngô thăng cấp (Chỉ Admin)')
    .addStringOption((opt) =>
      opt
        .setName('thang')
        .setDescription('Tên tháng tổng kết (Ví dụ: Tháng 10/2026)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('top_1_3')
        .setDescription('Danh sách mention/ID của Top 1 đến Top 3 (cách nhau bởi dấu cách hoặc phẩy)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('top_4_10')
        .setDescription('Danh sách mention/ID của Top 4 đến Top 10')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('top_11_20')
        .setDescription('Danh sách mention/ID của Top 11 đến Top 20')
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
      const top1_3Raw = interaction.options.getString('top_1_3', true);
      const top4_10Raw = interaction.options.getString('top_4_10') || '';
      const top11_20Raw = interaction.options.getString('top_11_20') || '';

      const guild = interaction.guild;
      const botClient = client || interaction.client;

      // 2. Xử lý qua Service: Lưu điểm, DM người chưa chọn phe, kiểm tra thăng cấp & đổi role
      const results = await WitchHunterService.processMonthlyLeaderboard(guild, botClient, {
        top1_3Raw,
        top4_10Raw,
        top11_20Raw,
        thang,
      });

      const { emojis, colors, channels } = WITCH_HUNTER_CONFIG;

      // 3. Xây dựng Embed Vinh Danh Hoàng Kim (Màu tím pastel nhạt nhạt cố định)
      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple) // Cố định màu tím pastel nhạt nhạt
        .setTitle(`${emojis.titleLeft} 𝓥𝓲𝓷𝓱 𝓓𝓪𝓷𝓱 𝓑𝓪̉𝓷𝓰 𝓧𝓮̂́𝓹 𝓗𝓪̣𝓷𝓰 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽 - ${thang} ${emojis.titleRight}`)
        .setDescription(
          `Trải qua những ngày đêm rèn luyện ma thuật và giao chiến khốc liệt, Bảng Xếp Hạng vinh quang **${thang}** đã chính thức khép lại!\n` +
          `Ban Quản Trị xin trân trọng trao tặng tinh hoa Bí Ngô ${emojis.pumpkin} cho những bậc kỳ tài xuất sắc nhất:\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );

      const formatUserList = (items) => {
        if (!items || items.length === 0) return '*Không có thành viên*';
        return items
          .map((item, idx) => {
            const factionTag = item.faction
              ? item.faction === 'hunter'
                ? `[⚔️ Thợ Săn]`
                : `[🔮 Phù Thủy]`
              : `*(Chưa chọn phe)*`;
            return `**#${idx + 1}.** <@${item.userId}> ${factionTag} • Tổng: **${item.pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}`;
          })
          .join('\n');
      };

      // Top 1 - 3 (+100 Bí Ngô)
      embed.addFields({
        name: `🏆 TOP 1 - 3 THÁNG (+100 Bí Ngô ${emojis.pumpkin}):`,
        value: formatUserList(results.top1_3),
        inline: false,
      });

      // Top 4 - 10 (+50 Bí Ngô)
      if (results.top4_10.length > 0) {
        embed.addFields({
          name: `⚔️ TOP 4 - 10 THÁNG (+50 Bí Ngô ${emojis.pumpkin}):`,
          value: formatUserList(results.top4_10),
          inline: false,
        });
      }

      // Top 11 - 20 (+25 Bí Ngô)
      if (results.top11_20.length > 0) {
        embed.addFields({
          name: `🔮 TOP 11 - 20 THÁNG (+25 Bí Ngô ${emojis.pumpkin}):`,
          value: formatUserList(results.top11_20),
          inline: false,
        });
      }

      // Đánh dấu đặc biệt những thành viên THĂNG CẤP VƯỢT BẬC kèm câu thoại chuẩn
      if (results.rankUps.length > 0) {
        const rankUpLines = results.rankUps.map((r) => r.quote).join('\n\n');

        embed.addFields({
          name: `✨ DANH SÁCH THĂNG CẤP VƯỢT BẬC KỲ NÀY:`,
          value: rankUpLines,
          inline: false,
        });
      }

      // Ghi chú nếu có người nhận được điểm nhưng chưa chọn phe
      if (results.dmReminded.length > 0) {
        embed.addFields({
          name: `📩 LƯU Ý CHO THÀNH VIÊN CHƯA CHỌN PHE:`,
          value: `Có **${results.dmReminded.length}** thành viên trong danh sách chưa chọn phe. Em bot Usagi múp rụp đã gửi thư riêng nhắc nhở ghé qua kênh <#${channels.selectionChannelId}> để ký khế ước nhận role rồi nha! 💕`,
          inline: false,
        });
      }

      embed
        .setFooter({
          text: `Witch Hunter System • Tổng kết bởi em bot Usagi múp rụp phục vụ vợ của Kim Nong 💕`,
        })
        .setTimestamp();

      // 4. Gửi vào Kênh ID 1563069218214121513
      const announcementChannel = guild.channels.cache.get(channels.announcementChannelId) || interaction.channel;
      if (announcementChannel) {
        await announcementChannel.send({ embeds: [embed] });
      }

      return interaction.editReply({
        content: `✅ Em bot Usagi múp rụp đã chốt BXH **${thang}** thành công và gửi thông báo vinh danh tới kênh <#${announcementChannel?.id || channels.announcementChannelId}> rồi nè vợ của Kim Nong ơi! 💕`,
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
