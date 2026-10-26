import { MessageFlags } from 'discord.js';
import { WitchHunterService } from '../../../services/witchHunterService.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'profile_equip_supporter',

  async execute(interaction, client, args = []) {
    try {
      const [authorId] = args;

      if (authorId && interaction.user.id !== authorId) {
        return interaction.reply({
          content: '❌ Chỉ chủ sở hữu hồ sơ mới có thể thay đổi trang bị Supporter!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const selectedValue = interaction.values?.[0];
      if (!selectedValue) return;

      const result = WitchHunterService.equipSupporter(interaction.user.id, selectedValue);

      if (!result.success) {
        return interaction.reply({
          content: result.message,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Tái tạo Profile Embed và components sau khi trang bị
      const updatedEmbed = WitchHunterService.buildProfileEmbed(interaction.user, interaction.user);
      const updatedComponents = WitchHunterService.createProfileEquipComponents(interaction.user.id);

      await interaction.update({
        embeds: [updatedEmbed],
        components: updatedComponents,
      });

      const suppName = result.isDefault
        ? `Mặc Định Theo Cấp Bậc (${result.supporter?.name || ''})`
        : result.supporter?.name;

      await interaction.followUp({
        content: `<a:trangtrig31:1546905996893626440> Đã trang bị thành công Supporter **${suppName}** xuất trận!`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi khi xử lý profile_equip_supporter menu:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Đã có lỗi xảy ra khi đổi Supporter, vui lòng thử lại sau!',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    }
  },
};
