import { MessageFlags } from 'discord.js';
import {
  WitchHunterQuestService,
  witchHunterQuestStorage,
  getVietnamDate,
} from '../../services/witchHunterQuestService.js';
import { witchHunterStorage } from '../../services/witchHunterService.js';
import { logger } from '../../utils/logger.js';

export default {
  name: 'btn_daily_candle',

  async execute(interaction) {
    try {
      const userId = interaction.user?.id || interaction.member?.id;

      if (!userId) {
        return interaction.reply({
          content: 'Không thể xác định thông tin người dùng!',
          flags: MessageFlags.Ephemeral,
        });
      }

      // 1. Chống spam click liên tục (race condition lock)
      if (WitchHunterQuestService.pendingCandles.has(userId)) {
        return interaction.reply({
          content: '⏳ Thao tác đang được xử lý, vui lòng không nhấn liên tục!',
          flags: MessageFlags.Ephemeral,
        });
      }

      // 2. Early Return (Guard Clause) tuyệt đối:
      // Nếu đã thắp nến trong ngày hôm nay: Gửi tin nhắn từ chối và DỪNG NGAY TIẾN TRÌNH
      const today = getVietnamDate();
      const existing = witchHunterQuestStorage.getDailyRitual(userId);
      const mainUser = witchHunterStorage.getUser(userId);

      if ((existing && existing.last_candle_date === today) || (mainUser && mainUser.last_candle_date === today)) {
        return interaction.reply({
          content: 'Ngọn nến hôm nay đã cháy hết. Hãy quay lại vào lúc nửa đêm (00:00) để tiếp tục nghi thức!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const result = await WitchHunterQuestService.handleDailyCandle(
        interaction.guild,
        interaction.member || interaction.user
      );

      if (!result.success) {
        return interaction.reply({
          content: result.message || 'Ngọn nến hôm nay đã cháy hết. Hãy quay lại vào lúc nửa đêm (00:00) để tiếp tục nghi thức!',
          flags: MessageFlags.Ephemeral,
        });
      }

      let responseText = '';
      if (result.isJackpot) {
        responseText = `<a:giftg1:1543150714732412948> **Trăng Máu Chiếu Rọi!** Ngươi gặp đại vận hiếm có từ ngọn nến cổ đại. Nhận ngay **+10 Bí Ngô** <a:bingo:1563061901800243253>! (Chuỗi: ${result.streak} ngày)`;
      } else {
        responseText = `<a:trangtrig48:1563552038883958855> Ngọn nến đã bốc cháy, khế ước linh hồn được duy trì. Ngươi nhận được **+1 Bí Ngô** <a:bingo:1563061901800243253>. (Chuỗi: ${result.streak} ngày)`;
      }

      if (result.isStreakBonus) {
        responseText += `\n<a:trangtrig38:1547237720332439574> **Bền Bỉ Phụng Sự**: Ngươi đã duy trì thắp nến đủ **7 ngày liên tục**, Hội Đồng Ma Thuật ban thưởng thêm **+5 Bí Ngô** <a:bingo:1563061901800243253>!`;
      }

      return interaction.reply({
        content: responseText,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterQuest] Lỗi bấm nút thắp nến:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra khi thắp nến: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
