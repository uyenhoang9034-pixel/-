import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import {
  THAN_VAN_CHANNEL_ID,
  buildMeetingEmbed,
  buildMeetingActionRow,
  getOrCreateMeetingSession,
} from '../../services/thanVanTuBanService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('hop-vo-tri')
    .setDescription('💤 Cảnh báo phòng họp gây mê & gửi lời an ủi tâm linh')
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName('dong-chi')
        .setDescription(
          'Đồng chí đang bị giam cầm trong phòng họp (để trống nếu là chính bạn)',
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
          content: `❌ Lệnh này chỉ được sử dụng cố định tại kênh Than Vãn Tư Bản (<#${THAN_VAN_CHANNEL_ID}>) thôi nha! Mau qua đó thắp nến cầu giải thoát nhé! 🕯️`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const victim = interaction.options.getUser('dong-chi') || interaction.user;
      const embed = buildMeetingEmbed(null, victim);
      const row = buildMeetingActionRow();

      const reply = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true,
      });

      if (reply) {
        getOrCreateMeetingSession(reply.id, victim);
      }

      logger.info(
        `[MeetingSucks] ${interaction.user.tag} đã tạo cảnh báo họp vô tri cho ${victim.tag} tại ${interaction.channelId}`,
      );
    } catch (error) {
      logger.error('Error executing /hop-vo-tri command:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content:
              '❌ Đã có lỗi xảy ra khi tạo cảnh báo phòng họp. Vui lòng thử lại sau!',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  },
};
