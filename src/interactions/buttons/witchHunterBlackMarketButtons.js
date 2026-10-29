import { MessageFlags } from 'discord.js';
import { WitchHunterBlackMarketService } from '../../services/witchHunterBlackMarketService.js';
import { logger } from '../../utils/logger.js';

export default [
  // 1. Nút bấm xác nhận giao dịch Chợ Đen
  {
    name: 'black_market_confirm',
    async execute(interaction, client, args = []) {
      try {
        const [type, itemId] = args;
        if (!type || !itemId) {
          return interaction.reply({
            content: '❌ Dữ liệu giao dịch không hợp lệ!',
            flags: MessageFlags.Ephemeral,
          });
        }

        const result = await WitchHunterBlackMarketService.executePurchase({
          userId: interaction.user.id,
          type,
          itemId,
          guild: interaction.guild,
          client,
          user: interaction.user,
        });

        if (!result.success) {
          if (result.notEnough) {
            const errEmbed = WitchHunterBlackMarketService.buildInsufficientBalanceEmbed(
              result.required,
              result.current
            );
            return interaction.update({
              embeds: [errEmbed],
              components: [],
            });
          }

          return interaction.reply({
            content: `❌ Giao dịch thất bại: ${result.message}`,
            flags: MessageFlags.Ephemeral,
          });
        }

        // Cập nhật tin nhắn ẩn của người chơi thành giao diện thành công
        await interaction.update({
          embeds: [result.embed],
          components: [],
        });
      } catch (error) {
        logger.error('❌ [WitchHunterBlackMarket] Lỗi khi xử lý black_market_confirm button:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Đã có lỗi xảy ra trong quá trình hoàn tất giao dịch, vui lòng thử lại sau!',
            flags: MessageFlags.Ephemeral,
          }).catch(() => null);
        }
      }
    },
  },

  // 2. Nút bấm hủy giao dịch Chợ Đen
  {
    name: 'black_market_cancel',
    async execute(interaction) {
      try {
        await interaction.update({
          content:
            '<a:bang2:1546891483250954290> **PHIÊN GIAO DỊCH ĐÃ BỊ HỦY BỎ!**\n' +
            '> Lữ khách đã hủy thao tác trao đổi. Toàn bộ số Mảnh Vỡ Ký Ức vẫn được giữ nguyên vẹn trong túi đồ.',
          embeds: [],
          components: [],
        });
      } catch (error) {
        logger.error('❌ [WitchHunterBlackMarket] Lỗi khi xử lý black_market_cancel button:', error);
      }
    },
  },
];
