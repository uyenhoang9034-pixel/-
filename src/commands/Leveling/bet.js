import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WitchHunterDuelService } from '../../services/witchHunterDuelService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bet')
    .setDescription('Xem thông tin vé cược cá nhân và tiền thưởng dự kiến qua tin nhắn ẩn'),

  category: 'Leveling',

  async execute(interaction) {
    try {
      const guild = interaction.guild;

      if (!guild) {
        return interaction.reply({
          content: 'Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const duel = WitchHunterDuelService.activeDuels.get(guild.id);

      if (!duel || duel.status === 'ENDED') {
        return interaction.reply({
          content: 'Hiện không có trận đấu nào đang diễn ra để tra cứu vé cược!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const userId = interaction.user.id;
      const userBets = duel.bets.filter((b) => b.userId === userId);

      if (userBets.length === 0) {
        return interaction.reply({
          content: 'Bạn chưa đặt cược vào trận chiến Huyết Thệ này!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const { hunterOdds, witchOdds } = WitchHunterDuelService.calculateBetOdds(duel);

      const lines = userBets.map((b, idx) => {
        const isHunter = b.faction === 'hunter';
        const odds = isHunter ? hunterOdds : witchOdds;
        const factionName = isHunter ? 'Hiệp Hội Thợ Săn' : 'Hội Phù Thủy';
        const estWin = Math.round(b.amount * Number(odds));
        return `> **#${idx + 1}.** Cược **${b.amount} Bí Ngô** vào **${factionName}** (Tỷ lệ: x${odds} ➔ Tiền thưởng dự kiến: **+${estWin} Bí Ngô** <a:bingo:1563061901800243253>)`;
      });

      return interaction.reply({
        content:
          `🎟️ **VÉ CƯỢC CÁ NHÂN CỦA BẠN:**\n` +
          lines.join('\n') +
          `\n\n*Tiền thưởng sẽ tự động cộng thẳng vào tài khoản của bạn nếu phe bạn cược giành chiến thắng!*`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [BetCommand] Lỗi lệnh /bet:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
