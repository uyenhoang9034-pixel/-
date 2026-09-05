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

  async execute(interaction, client) {
    const session =
      audioManager.getOrCreateSession(
        interaction.guildId,
      );

    const selectedIndex =
      Number(
        interaction.values?.[0],
      );

    /*
     * Kiểm tra kết quả tìm kiếm còn tồn tại.
     */
    if (
      !Number.isInteger(
        selectedIndex,
      ) ||
      selectedIndex < 0 ||
      selectedIndex >=
        (
          session.searchResults?.length ||
          0
        )
    ) {
      return interaction.reply({
        content:
          '🌸 Kết quả này đã hết hạn. Hãy tìm kiếm lại nhé.',
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
          '🌸 Audio này không còn khả dụng. Hãy tìm lại nhé.',
        ephemeral: true,
      });
    }

    /*
     * Người dùng phải ở trong voice channel.
     */
    const voiceChannel =
      interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content:
          '🌸 Bạn cần vào voice channel trước khi nghe audio nhé.',
        ephemeral: true,
      });
    }

    await interaction.deferUpdate();

    try {
      /*
       * Dùng PLAYER của hệ thống Music hiện tại.
       *
       * Không tạo Riffy connection riêng.
       */
      const {
        player,
      } = await ensurePlayer(
        client,
        interaction,
      );

      const track =
        result.track;

      /*
       * Lưu người yêu cầu audio.
       */
      if (track.info) {
        track.info.requester =
          interaction.user;
      }

      /*
       * Lưu Audio queue riêng.
       */
      session.queue ??= [];

      session.queue.push(
        createSessionTrack(track),
      );

      /*
       * Thêm track vào Riffy queue.
       */
      player.queue.add(
        track,
      );

      /*
       * Lưu thông tin session.
       */
      session.voiceChannelId =
        voiceChannel.id;

      session.textChannelId =
        interaction.channelId;

      /*
       * Volume mặc định.
       */
      session.volume =
        Number(
          session.volume ?? 100,
        );

      player.setVolume(
        session.volume,
      );

      /*
       * Player đang idle?
       *
       * Nếu có thì bắt đầu phát.
       */
      const shouldStart =
        !player.playing &&
        !player.paused &&
        !player.current;

      if (shouldStart) {
        /*
         * QUAN TRỌNG:
         *
         * Dùng chính startPlayback()
         * của Music system.
         *
         * Hàm này đã xử lý:
         * - Lavalink
         * - Discord Voice State
         * - Riffy connection
         * - player.play()
         */
        await startPlayback(
          player,
        );
      }

      /*
       * Riffy có thể cần một chút thời gian
       * để cập nhật player.current.
       *
       * Fallback về track vừa chọn nếu cần.
       */
      const currentTrack =
        player.current ||
        track;

      session.currentTrack =
        createSessionTrack(
          currentTrack,
        );

      session.isPlaying =
        true;

      session.isPaused =
        false;

      /*
       * Hiển thị Usagi Audio Dashboard.
       */
      return interaction.editReply(
        buildAudioPlayerDashboard(
          currentTrack,
          player,
          session,
        ),
      );

    } catch (error) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              '🌸 Không thể phát audio',
            )
            .setDescription(
              [
                'Usagi tìm thấy audio nhưng không thể bắt đầu phát.',
                '',
                `> ${
                  error?.message ||
                  'Unknown error'
                }`,
                '',
                'Hãy kiểm tra bot có quyền **Connect** và **Speak** trong voice channel nhé ♡',
              ].join('\n'),
            )
            .setColor(
              0xed4245,
            ),
        ],
        components: [],
      });
    }
  },
};
