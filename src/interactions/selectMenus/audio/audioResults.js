import {
  EmbedBuilder,
} from 'discord.js';

import audioManager from '../../../services/audio/audioManager.js';

import {
  ensurePlayer,
} from '../../../services/music/musicActions.js';

import {
  formatAudioDuration,
} from '../../../services/audio/audioYouTube.js';

export default {
  name: 'audioResults',

  async execute(interaction) {
    const session = audioManager.getOrCreateSession(
      interaction.guildId,
    );

    const selectedIndex = Number(
      interaction.values?.[0],
    );

    if (
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= (session.searchResults?.length || 0)
    ) {
      return interaction.reply({
        content:
          '🌸 Kết quả này đã hết hạn. Hãy tìm kiếm lại nhé.',
        ephemeral: true,
      });
    }

    const result =
      session.searchResults[selectedIndex];

    if (!result?.track) {
      return interaction.reply({
        content:
          '🌸 Audio này không còn khả dụng. Hãy tìm lại nhé.',
        ephemeral: true,
      });
    }

    /*
     * The user must be inside a voice channel.
     */
    if (!interaction.member?.voice?.channel) {
      return interaction.reply({
        content:
          '🌸 Bạn cần vào một voice channel trước khi nghe audio nhé.',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      /*
       * Reuse the existing Riffy/Lavalink voice connection system.
       */
      const {
        player,
      } = await ensurePlayer(
        interaction.client,
        interaction,
      );

      const track = result.track;

      track.info.requester = interaction.user;

      /*
       * Add the selected YouTube track to the queue.
       */
      player.queue.add(track);

      /*
       * Start immediately if nothing is currently playing.
       */
      const shouldStart =
        !player.playing &&
        !player.paused &&
        !player.current;

      if (shouldStart) {
        await player.play();
      }

      /*
       * Remember the selected track.
       */
      session.currentTrack = result;
      session.voiceChannelId =
        interaction.member.voice.channel.id;
      session.textChannelId =
        interaction.channelId;
      session.isPlaying = true;
      session.isPaused = false;

      const embed = new EmbedBuilder()
        .setTitle('🎧 Usagi đang phát')
        .setDescription(
          [
            `**${result.title}**`,
            '',
            `👤 ${result.author}`,
            `⏱️ ${formatAudioDuration(result.duration)}`,
            '',
            '🌸 Đã bắt đầu phát audio trong voice channel.',
          ].join('\n'),
        )
        .setColor(0xffb6d9);

      if (result.thumbnail) {
        embed.setThumbnail(result.thumbnail);
      }

      return interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🌸 Không thể phát audio')
            .setDescription(
              [
                'Usagi tìm thấy audio nhưng không thể bắt đầu phát.',
                '',
                `> ${error?.message || 'Unknown error'}`,
              ].join('\n'),
            )
            .setColor(0xed4245),
        ],
      });
    }
  },
};
