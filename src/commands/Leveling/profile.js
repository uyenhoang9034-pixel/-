import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterService } from '../../services/witchHunterService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Tra cứu hồ sơ cá nhân, cấp bậc và tiến trình Bí Ngô Witch Hunter của bạn'),

  category: 'Leveling',

  async execute(interaction) {
    try {
      const user = interaction.user;
      const userId = user.id;

      // 1. Lấy dữ liệu người dùng từ Database
      const userData = WitchHunterService.getUserProfile(userId);
      const pumpkins = userData?.pumpkins || 0;
      const faction = userData?.faction || null;
      const currentRank = userData?.current_rank || 1;

      const { emojis, colors, channels } = WITCH_HUNTER_CONFIG;

      // 2. Trường hợp chưa ký khế ước chọn phe
      if (!faction) {
        const unassignedEmbed = new EmbedBuilder()
          .setColor(colors.pastelPurple) // Cố định màu tím pastel nhạt nhạt
          .setTitle(`${emojis.titleLeft} 𝓗𝓸̂̀ 𝓢𝓸̛ 𝓒𝓪́ 𝓝𝓱𝓪̂𝓷: ${user.username} ${emojis.titleRight}`)
          .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setDescription(
            `Chào **${user.username}**! Hiện tại bạn **chưa ký khế ước gia nhập phe phái** nào trong thế giới **Witch Hunter**.\n\n` +
            `${emojis.pumpkin} **Bí Ngô tích lũy:** **${pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
            `⚔️ **Phe phái:** *Vô môn vô phái (Chưa gia nhập)*\n` +
            `🎖️ **Cấp bậc:** *Chưa phân định*\n\n` +
            `💡 **Lời nhắn từ em bot Usagi múp rụp:**\n` +
            `> Hãy ghé qua kênh <#${channels.selectionChannelId}> để bấm nút gia nhập **Hiệp Hội Thợ Săn** hoặc **Hội Phù Thủy** và nhận Role danh hiệu ngay nha vợ của Kim Nong ơi! 💕`
          )
          .setFooter({
            text: 'Witch Hunter Profile • Chỉ hiển thị cho riêng bạn • Em bot Usagi múp rụp 💕',
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [unassignedEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // 3. Trường hợp ĐÃ GIA NHẬP PHE
      const isHunter = faction === 'hunter';
      const factionName = isHunter ? 'Hiệp Hội Thợ Săn (W.H. Association)' : 'Hội Phù Thủy (Witches)';
      const factionBadge = isHunter ? emojis.hunterBadge : emojis.witchBadge;

      const progress = WitchHunterService.getProgressDetails(faction, pumpkins, currentRank);
      const rankInfo = WitchHunterService.getRankInfo(faction, currentRank);

      const profileEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple) // Cố định màu tím pastel nhạt nhạt
        .setTitle(`${emojis.titleLeft} 𝓗𝓸̂̀ 𝓢𝓸̛ 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽: ${user.username} ${emojis.titleRight}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription(
          `Chiến binh huyền thoại của thế giới ma thuật **Witch Hunter**:\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .addFields(
          {
            name: `${factionBadge} Phe Phái Tham Chiến:`,
            value: `**${factionName}**`,
            inline: true,
          },
          {
            name: `🎖️ Cấp Bậc Hiện Tại:`,
            value: `**${rankInfo.name}**\n*(${rankInfo.title})*`,
            inline: true,
          },
          {
            name: `${emojis.pumpkin} Bí Ngô Sở Hữu:`,
            value: `**${pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}`,
            inline: true,
          },
          {
            name: `📊 Tiến Trình Đột Phá Bậc Kế Tiếp:`,
            value:
              `${progress.progressBar}\n` +
              `> ${progress.formattedStatus}`,
            inline: false,
          }
        )
        .setFooter({
          text: `Witch Hunter Profile • Chỉ hiển thị cho riêng bạn • Em bot Usagi múp rụp 💕`,
        })
        .setTimestamp();

      return interaction.reply({
        embeds: [profileEmbed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi lệnh profile:', error);
      return interaction.reply({
        content: `Đã xảy ra lỗi khi tra cứu hồ sơ: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
