import { MessageFlags } from 'discord.js';
import { WitchHunterSummonService } from '../../../services/witchHunterSummonService.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'select_summon_type',

  async execute(interaction) {
    try {
      const selectedValue = interaction.values?.[0];
      if (!selectedValue || !['supporter', 'weapon'].includes(selectedValue)) {
        return interaction.reply({
          content: 'Lựa chọn tế đàn không hợp lệ!',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Lưu trạng thái tế đàn được chọn riêng cho người dùng này
      WitchHunterSummonService.setUserSelectedType(interaction.user.id, selectedValue);

      const typeName = selectedValue === 'supporter'
        ? '🔮 **Triệu Hồi Supporter** *(Khế Ước Đồng Hành A - S - SS)*'
        : '⚔️ **Triệu Hồi Thần Khí** *(Thần Khí Liên Kết Độc Bản A - S - SS)*';

      return interaction.reply({
        content: `✅ Lữ khách <@${interaction.user.id}> đã chọn tế đàn: ${typeName}!\n👉 Hãy nhấn nút **Quay 1 Lần** hoặc **Quay 10 Lần** bên dưới để bắt đầu dâng hiến Bí Ngô nhé 💕`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterSummon] Lỗi khi xử lý select_summon_type:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra khi chọn tế đàn: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
