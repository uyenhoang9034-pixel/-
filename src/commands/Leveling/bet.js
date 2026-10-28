import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterDuelService } from '../../services/witchHunterDuelService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bet')
    .setDescription('Hệ thống Sòng Cược Huyết Thệ Witch Hunter (Pari-mutuel Pool)')
    .addSubcommand((sub) =>
      sub
        .setName('place')
        .setDescription('Đặt cược số Bí Ngô vào một phe trong thời gian mở cược')
        .addStringOption((opt) =>
          opt
            .setName('phe')
            .setDescription('Phe muốn đặt cược')
            .setRequired(true)
            .addChoices(
              { name: 'Hiệp Hội Thợ Săn (Hunter)', value: 'hunter' },
              { name: 'Hội Phù Thủy (Witch)', value: 'witch' }
            )
        )
        .addIntegerOption((opt) =>
          opt
            .setName('so-luong')
            .setDescription('Số lượng Bí Ngô muốn đặt cược')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('pool')
        .setDescription('Kiểm tra tổng số Bí Ngô trong bể cược và tỷ lệ ăn chia tạm tính')
    )
    .addSubcommand((sub) =>
      sub
        .setName('mybet')
        .setDescription('Xem thông tin vé cược cá nhân và tiền thưởng dự kiến qua tin nhắn ẩn')
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const guild = interaction.guild;

      if (!guild) {
        return interaction.reply({
          content: 'Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const duel = WitchHunterDuelService.activeDuels.get(guild.id);

      // ────────────────────────────────────────────────────────────
      // 1. SUBCOMMAND: PLACE
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'place') {
        const faction = interaction.options.getString('phe', true);
        const amount = interaction.options.getInteger('so-luong', true);

        const res = await WitchHunterDuelService.placeBet({
          interaction,
          userId: interaction.user.id,
          faction,
          amount,
        });

        return interaction.reply({
          content: res.message,
          flags: MessageFlags.Ephemeral,
        });
      }

      // ────────────────────────────────────────────────────────────
      // 2. SUBCOMMAND: POOL
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'pool') {
        if (!duel || duel.status === 'ENDED') {
          return interaction.reply({
            content: 'Hiện không có sòng cược Huyết Thệ nào đang mở cửa!',
            flags: MessageFlags.Ephemeral,
          });
        }

        const { hunterTotal, witchTotal, totalPool, netPool, hunterOdds, witchOdds, hunterCount, witchCount } =
          WitchHunterDuelService.calculateBetOdds(duel);

        const statusText = duel.status === 'BETTING' ? '🟢 **ĐANG MỞ CỬA NHẬN CƯỢC**' : '🔒 **ĐÃ KHÓA CƯỢC (ĐANG CHIẾN ĐẤU)**';

        return interaction.reply({
          content:
            `🎲 **THÔNG TIN BỂ CƯỢC SÒNG CƯỢC HUYẾT THỆ:**\n` +
            `• Trạng thái: ${statusText}\n` +
            `• Tổng quỹ cược: **${totalPool.toLocaleString('vi-VN')}** <a:bingo:1563061901800243253> (Quỹ trả sau thuế 10%: **${Math.round(netPool).toLocaleString('vi-VN')}**)\n\n` +
            `<a:trangtrig36:1563065680922808340> **Hiệp Hội Thợ Săn:**\n` +
            `  - Tổng cược: **${hunterTotal.toLocaleString('vi-VN')}** Bí Ngô (${hunterCount} lượt)\n` +
            `  - Tỷ lệ ăn dự kiến: **x${hunterOdds}**\n\n` +
            `<a:trangtrig32:1546906170994856026> **Hội Phù Thủy:**\n` +
            `  - Tổng cược: **${witchTotal.toLocaleString('vi-VN')}** Bí Ngô (${witchCount} lượt)\n` +
            `  - Tỷ lệ ăn dự kiến: **x${witchOdds}**`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // ────────────────────────────────────────────────────────────
      // 3. SUBCOMMAND: MYBET
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'mybet') {
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
      }
    } catch (error) {
      logger.error('❌ [BetCommand] Lỗi lệnh /bet:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
