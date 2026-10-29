import { MessageFlags } from 'discord.js';
import { WitchHunterService } from '../../../services/witchHunterService.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'profile_equip_dark_title',

  async execute(interaction, client, args = []) {
    try {
      const [authorId] = args;

      if (authorId && interaction.user.id !== authorId) {
        return interaction.reply({
          content: '❌ Chỉ chủ sở hữu hồ sơ mới có thể thay đổi danh hiệu hắc ám!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const selectedValue = interaction.values?.[0];
      if (!selectedValue) return;

      const result = await WitchHunterService.equipDarkTitle(
        interaction.user.id,
        selectedValue,
        interaction.guild
      );

      if (!result.success) {
        return interaction.reply({
          content: result.message,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Tái tạo Profile Embed và components sau khi trang bị danh hiệu
      const updatedEmbed = WitchHunterService.buildProfileEmbed(interaction.user, interaction.user);
      const updatedComponents = WitchHunterService.createProfileEquipComponents(interaction.user.id);

      await interaction.update({
        embeds: [updatedEmbed],
        components: updatedComponents,
      });

      const titleNotice = result.isNone
        ? 'Đã gỡ Danh Hiệu Hắc Ám khỏi hồ sơ cá nhân!'
        : `Đã khắc ấn thành công Danh Hiệu Hắc Ám ｢ **${result.title.nameVi}** ｣ vào hồ sơ ma thuật!`;

      await interaction.followUp({
        content: `<a:trangtrig14:1546047912969113622> ${titleNotice}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi khi xử lý profile_equip_dark_title menu:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Đã có lỗi xảy ra khi đổi danh hiệu, vui lòng thử lại sau!',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    }
  },
};
