import {
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterService } from '../../services/witchHunterService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bxh-bingo')
    .setDescription('Xem Bảng Xếp Hạng điểm Bí Ngô và Cấp Bậc Witch Hunter của server')
    .addStringOption((opt) =>
      opt
        .setName('phe')
        .setDescription('Lọc theo phe phái')
        .setRequired(false)
        .addChoices(
          { name: 'Toàn Server (Tất cả)', value: 'all' },
          { name: '⚔️ Hiệp Hội Thợ Săn', value: 'hunter' },
          { name: '🔮 Hội Phù Thủy', value: 'witch' }
        )
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      const chosenFaction = interaction.options.getString('phe') || 'all';
      const filterFaction = chosenFaction === 'all' ? null : chosenFaction;

      const topMembers = WitchHunterService.getPumpkinLeaderboard(15, filterFaction);
      const factionStats = WitchHunterService.getFactionStats();
      const { emojis, colors } = WITCH_HUNTER_CONFIG;

      let title = `${emojis.titleLeft} 𝓑𝓪̉𝓷𝓰 𝓧𝓮̂́𝓹 𝓗𝓪̣𝓷𝓰 𝓑𝓲́ 𝓝𝓰𝓸̂ 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽 ${emojis.titleRight}`;
      if (chosenFaction === 'hunter') {
        title = `${emojis.titleLeft} 𝓑𝓧𝓗 𝓑𝓲́ 𝓝𝓰𝓸̂: 𝓗𝓲𝓮̣̂𝓹 𝓗𝓸̣̂𝓲 𝓣𝓱𝓸̛̣ 𝓢𝓪̆𝓷 ${emojis.titleRight}`;
      } else if (chosenFaction === 'witch') {
        title = `${emojis.titleLeft} 𝓑𝓧𝓗 𝓑𝓲́ 𝓝𝓰𝓸̂: 𝓗𝓸̣̂𝓲 𝓟𝓱𝓾̀ 𝓣𝓱𝓾̉𝔂 ${emojis.titleRight}`;
      }

      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple) // Màu tím pastel nhạt nhạt cố định
        .setTitle(title);

      // Thống kê đại chiến giữa 2 phe
      embed.setDescription(
        `${emojis.decor46 || '<a:trangtrig46:1547240249761996812>'} **ĐẠI CHIẾN MA THUẬT: THỢ SĂN vs PHÙ THỦY**\n` +
        `> ${emojis.hunterButton} **Hiệp Hội Thợ Săn:** **${factionStats.hunter.count}** thành viên • **${factionStats.hunter.pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
        `> ${emojis.witchButton} **Hội Phù Thủy:** **${factionStats.witch.count}** thành viên • **${factionStats.witch.pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );

      if (topMembers.length === 0) {
        embed.addFields({
          name: '🏆 DANH SÁCH BẢNG XẾP HẠNG:',
          value: '*Hiện tại chưa có thành viên nào có điểm Bí Ngô.*',
        });
      } else {
        const lines = topMembers.map((item, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}.**`;
          const factionTag = item.faction
            ? item.faction === 'hunter'
              ? `[${emojis.hunterButton} Thợ Săn]`
              : `[${emojis.witchButton} Phù Thủy]`
            : `*(Chưa chọn phe)*`;

          const rankInfo = item.faction
            ? WitchHunterService.getRankInfo(item.faction, item.current_rank || 1)
            : null;
          const rankText = rankInfo ? `• Cấp: **${rankInfo.name}**` : '';

          return `${medal} <@${item.user_id}> ${factionTag} ${rankText}\n> ${emojis.pumpkin} Tích lũy: **${(item.pumpkins || 0).toLocaleString('vi-VN')}** Bí Ngô`;
        });

        embed.addFields({
          name: `🏆 TOP ${topMembers.length} THÀNH VIÊN XUẤT SẮC NHẤT:`,
          value: lines.join('\n\n'),
        });
      }

      // Vị trí của người dùng hiện tại
      const myProfile = WitchHunterService.getUserProfile(interaction.user.id);
      if (myProfile) {
        const myRankInfo = myProfile.faction
          ? WitchHunterService.getRankInfo(myProfile.faction, myProfile.current_rank || 1)
          : null;
        embed.addFields({
          name: `${emojis.heart || '<a:heartg1:1545307544808071258>'} HỒ SƠ CỦA BẠN:`,
          value:
            `> ${emojis.pumpkin} Điểm Bí Ngô: **${(myProfile.pumpkins || 0).toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
            `> ${emojis.decor21 || '<a:trangtrig21:1546093099770716213>'} Cấp bậc: **${myRankInfo?.name || 'Chưa phân định'}** (${myProfile.faction === 'hunter' ? 'Thợ Săn' : myProfile.faction === 'witch' ? 'Phù Thủy' : 'Chưa chọn phe'})`,
        });
      }

      embed
        .setFooter({
          text: 'Witch Hunter Leaderboard',
        })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi lệnh bxh-bingo:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
