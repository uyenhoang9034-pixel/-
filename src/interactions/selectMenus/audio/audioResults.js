import {
  EmbedBuilder,
} from 'discord.js';

import audioManager from '../../../services/audio/audioManager.js';

import {
  ensurePlayer,
  startPlayback,
} from '../../../services/music/musicActions.js';

import {
  buildAudioPlayerDashboard,
  buildAudioSearchDashboard,
} from '../../../services/audio/audioDashboard.js';

function createSessionTrack(track) {
  return {
    track,

    title:
      track?.info?.title ||
      'Unknown Audio',

    author:
      track?.info?.author ||
      'Unknown',

    duration:
      Number(track?.info?.length) ||
      0,

    thumbnail:
      track?.info?.artworkUrl ||
      track?.info?.thumbnail ||
      null,

    uri:
      track?.info?.uri ||
      null,
  };
}

export default {
  name: 'audioResults',

  async execute(
    interaction,
    client,
  ) {
    const session =
      audioManager.getOrCreateSession(
        interaction.guildId,
      );

    const selectedIndex =
      Number(
        interaction.values?.[0],
      );

    if (
      !Number.isInteger(
        selectedIndex,
      ) ||
      selectedIndex < 0 ||
      selectedIndex >=
        (
          session.searchResults
            ?.length || 0
        )
    ) {
      return interaction.reply({
        content:
          '🌸 Kết quả tìm kiếm đã hết hạn. Hãy tìm lại nhé.',
        ephemeral: true,
      });
    }

    const result =
      session.searchResults[
        selectedIndex
      ];

    if (!result?.track) {
      return interaction.reply({
        content:
          '🌸 Audio này không còn khả dụng.',
        ephemeral: true,
      });
    }

    const voiceChannel =
      interaction.member?.voice
        ?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content:
          '🌸 Bạn cần vào voice channel trước khi nghe.',
        ephemeral: true,
      });
    }

    await interaction.deferUpdate();

    try {
      const {
        player,
      } = await ensurePlayer(
        client,
        interaction,
      );

      const track =
        result.track;

      /*
       * ===================================================
       * ĐÁNH DẤU TRACK LÀ AUDIO
       * ===================================================
       *
       * Music playerHandler sẽ bỏ qua track này.
       */
      track.info ??= {};

      track.info.__usagiAudio =
        true;

      track.info.requester =
        interaction.user;

      /*
       * Audio queue riêng.
       */
      session.queue ??= [];

      session.queue.push(
        createSessionTrack(track),
      );

      session.voiceChannelId =
        voiceChannel.id;

      session.textChannelId =
        interaction.channelId;

      session.dashboardMessageId =
        interaction.message?.id ||
        session.dashboardMessageId;

      session.volume =
        Number(
          session.volume ?? 100,
        );

      player.setVolume(
        session.volume,
      );

      /*
       * Đánh dấu PLAYER đang phục vụ Audio.
       *
       * Music event handler sẽ kiểm tra
       * player.current / queue track.
       */
      player.__usagiAudio = true;

      /*
       * Chỉ play nếu player đang idle.
       */
      const shouldStart =
        !player.playing &&
        !player.paused &&
        !player.current;

      if (shouldStart) {
        await startPlayback(
          player,
        );
      }

      /*
       * Riffy có thể chưa cập nhật
       * player.current ngay lập tức.
       */
      const currentTrack =
        player.current ||
        track;

      session.currentTrack =
        createSessionTrack(
          currentTrack,
        );

      session.isPlaying =
        Boolean(
          player.playing ||
          currentTrack,
        );

      session.isPaused =
        Boolean(player.paused);

      /*
       * Giữ dashboard.
       */
      return interaction.editReply(
        buildAudioPlayerDashboard(
          currentTrack,
          player,
          session,
        ),
      );
    } catch (error) {
      /*
       * QUAN TRỌNG:
       *
       * KHÔNG dùng components: [].
       *
       * Nếu playback fail,
       * người dùng vẫn phải có nút Search.
       */
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              '🌸 Usagi chưa thể phát audio',
            )
            .setDescription(
              [
                'YouTube đã trả về kết quả nhưng Lavalink chưa thể phát audio này.',

                '',

                `🔎 **${result.title || 'Audio'}**`,

                '',

                `⚠️ ${
                  error?.message ||
                  'Unknown playback error'
                }`,

                '',

                'Bạn có thể tìm một kết quả khác bằng nút **Search** bên dưới.',
              ].join('\n'),
            )
            .setColor(0xed4245),
        ],

        components:
          buildAudioSearchDashboard()
            .components,
      });
    }
  },
};
