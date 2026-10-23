import { MessageFlags, EmbedBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterService } from '../../services/witchHunterService.js';
import { logger } from '../../utils/logger.js';

export default {
  name: 'witch_hunter_join',

  async execute(interaction, client, args = []) {
    try {
      const [chosenFaction] = args;
      const member = interaction.member;
      const guild = interaction.guild;

      if (!guild || !member) {
        return interaction.reply({
          content: 'Không tìm thấy dữ liệu máy chủ hoặc thông tin thành viên!',
          flags: MessageFlags.Ephemeral,
        });
      }

      // RÀNG BUỘC KÊNH: CHỈ NHẬN ROLE ĐƯỢC Ở KÊNH ID 1563069959658143894
      const requiredChannelId = WITCH_HUNTER_CONFIG.channels.selectionChannelId;
      if (interaction.channelId !== requiredChannelId) {
        return interaction.reply({
          content: `❌ Nghi thức chọn phe và nhận role chỉ có thể thực hiện tại kênh <#${requiredChannelId}> thôi nè vợ của Kim Nong ơi! 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!['hunter', 'witch'].includes(chosenFaction)) {
        return interaction.reply({
          content: 'Phe phái không hợp lệ!',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Xử lý gia nhập phe qua Service
      const result = await WitchHunterService.joinFaction(guild, member, chosenFaction);

      // 1. Trường hợp ĐÃ CHỌN PHE TRƯỚC ĐÓ => Chặn tuyệt đối
      if (result.alreadyChosen) {
        return interaction.reply({
          content: WITCH_HUNTER_CONFIG.messages.alreadyChosen,
          flags: MessageFlags.Ephemeral,
        });
      }

      // 2. Gia nhập thành công: Phản hồi ẩn chào mừng đúng câu thoại chuẩn
      const welcomeMessage = chosenFaction === 'witch'
        ? WITCH_HUNTER_CONFIG.messages.welcomeWitch(interaction.user.id)
        : WITCH_HUNTER_CONFIG.messages.welcomeHunter(interaction.user.id);

      const welcomeEmbed = new EmbedBuilder()
        .setColor(WITCH_HUNTER_CONFIG.colors.pastelPurple) // Cố định tím pastel nhạt nhạt
        .setDescription(welcomeMessage);

      return interaction.reply({
        embeds: [welcomeEmbed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi khi xử lý nút chọn phe:', error);
      return interaction.reply({
        content: `Có lỗi bất ngờ xảy ra khi ký kết khế ước: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
