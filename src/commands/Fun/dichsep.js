import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import {
  THAN_VAN_CHANNEL_ID,
  getTranslatorEntry,
  buildTranslatorEmbed,
} from '../../services/thanVanTuBanService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('dich-loi-sep')
    .setDescription('🕶️ Kính giải mã ngôn ngữ sếp & khách hàng nơi công sở')
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('tu-khoa')
        .setDescription(
          'Từ khóa hoặc câu nói cần giải mã (vd: asap, fyi, sắp xong chưa, ... hoặc để trống)',
        )
        .setRequired(false),
    ),

  async execute(interaction, guildConfig, client) {
    try {
      const isTargetChannel =
        interaction.channelId === THAN_VAN_CHANNEL_ID ||
        interaction.channel?.parentId === THAN_VAN_CHANNEL_ID;

      if (!isTargetChannel) {
        return interaction.reply({
          content: `❌ Lệnh này chỉ được sử dụng cố định tại kênh Than Vãn Tư Bản (<#${THAN_VAN_CHANNEL_ID}>) thôi nha! Mau qua đó đeo kính giải mã sếp nhé! 🕶️`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const input = interaction.options.getString('tu-khoa') || '';
      const entry = getTranslatorEntry(input);
      const embed = buildTranslatorEmbed(entry);

      return interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      logger.error('Error executing /dich-loi-sep command:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content:
              '❌ Đã có lỗi xảy ra khi giải mã lời nói của sếp. Vui lòng thử lại sau!',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  },
};
