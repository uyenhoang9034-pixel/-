import {
  SlashCommandBuilder,
} from 'discord.js';

import audioManager from '../../services/audio/audioManager.js';
import {
  buildAudioSearchDashboard,
} from '../../services/audio/audioDashboard.js';

export default {
  data: new SlashCommandBuilder()
    .setName('audio')
    .setDescription('Mở hệ thống Usagi Audio.'),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '🌸 Lệnh này chỉ có thể sử dụng trong server.',
        ephemeral: true,
      });
    }

    const guildId = interaction.guild.id;
    const channelId = interaction.channelId;

    const session = audioManager.getOrCreateSession(guildId);

    /*
     * Once an Audio channel has been configured,
     * /audio can only be used there.
     */
    if (
      session.audioChannelId &&
      !audioManager.isAllowedChannel(guildId, channelId)
    ) {
      return interaction.reply({
        content:
          '🌸 Hệ thống Audio chỉ có thể sử dụng trong kênh Audio được thiết lập.',
        ephemeral: true,
      });
    }

    /*
     * Remember where the Audio dashboard was created.
     */
    session.textChannelId = channelId;

    const dashboard = buildAudioSearchDashboard();

    await interaction.reply(dashboard);
  },
};
