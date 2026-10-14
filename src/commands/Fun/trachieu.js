import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import {
  THAN_VAN_CHANNEL_ID,
  buildTraChieuEmbed,
  buildTraChieuActionRow,
  getOrCreateSession,
} from '../../services/thanVanTuBanService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tra-chieu')
    .setDescription(
      'Báo động sập nguồn: Lên đơn trà chiều, bơm đường cứu rỗi linh hồn!',
    )
    .setDMPermission(false),

  async execute(interaction, guildConfig, client) {
    try {
      const isTargetChannel =
        interaction.channelId === THAN_VAN_CHANNEL_ID ||
        interaction.channel?.parentId === THAN_VAN_CHANNEL_ID;

      if (!isTargetChannel) {
        return interaction.reply({
          content: `❌ Lệnh này chỉ được sử dụng cố định tại kênh Than Vãn Tư Bản (<#${THAN_VAN_CHANNEL_ID}>) thôi nha! Hãy qua đó để lên đơn trà chiều nhé! 🧋`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const embed = buildTraChieuEmbed();
      const row = buildTraChieuActionRow();

      const reply = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true,
      });

      getOrCreateSession(reply.id);
    } catch (error) {
      logger.error('Error executing /tra-chieu command:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content:
              '❌ Đã có lỗi xảy ra khi lên đơn trà chiều. Vui lòng thử lại sau!',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  },
};
