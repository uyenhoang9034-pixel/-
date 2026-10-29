import { MessageFlags } from 'discord.js';
import { WITCH_HUNTER_CONFIG, getSupporterById } from '../../../config/witchHunterConfig.js';
import { WitchHunterService } from '../../../services/witchHunterService.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'supporter_select',

  async execute(interaction, client, args = []) {
    try {
      const [authorId, factionArg = 'hunter'] = args;

      // KIỂM TRA QUYỀN THAO TÁC: Chỉ người gõ lệnh /supporter mới được chọn menu
      if (authorId && interaction.user.id !== authorId) {
        const bangEmoji = WITCH_HUNTER_CONFIG.emojis.bang2 || '<a:bang2:1546891483250954290>';
        return interaction.reply({
          content: `${bangEmoji} Menu này thuộc phiên tra cứu của <@${authorId}> nè lữ khách ơi! Hãy tự gõ lệnh /supporter để mở bảng tra cứu riêng của mình nha ~`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const selectedValue = interaction.values?.[0];
      if (!selectedValue) return;

      let embed;
      let displayFaction = factionArg;
      let selectedSupporterId = selectedValue;

      if (selectedValue === 'overview') {
        embed = WitchHunterService.buildSupporterOverviewEmbed();
        selectedSupporterId = 'overview';
      } else if (selectedValue.startsWith('switch_faction_')) {
        displayFaction = selectedValue.replace('switch_faction_', '');
        embed = WitchHunterService.buildSupporterOverviewEmbed();
        selectedSupporterId = 'overview';
      } else {
        const supporter = getSupporterById(selectedValue);
        if (!supporter) {
          return interaction.reply({
            content: 'Không tìm thấy thông tin Supporter tương ứng trong kho lưu trữ!',
            flags: MessageFlags.Ephemeral,
          });
        }
        displayFaction = supporter.faction || factionArg;
        embed = WitchHunterService.buildSupporterDetailEmbed(supporter, authorId || interaction.user.id);
      }

      // Tái tạo ActionRow với option đang chọn để hiển thị trạng thái chuẩn
      const row = WitchHunterService.createSupporterSelectRow(
        authorId || interaction.user.id,
        selectedSupporterId,
        displayFaction
      );

      // Cập nhật công khai tin nhắn mà không xóa hoặc gửi tin nhắn mới
      await interaction.update({
        embeds: [embed],
        components: [row],
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi khi xử lý supporter_select menu:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Đã có lỗi xảy ra khi tra cứu thông tin Supporter, vui lòng thử lại sau!',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    }
  },
};
