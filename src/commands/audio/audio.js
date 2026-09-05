import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

import audioManager from '../../services/audio/audioManager.js';

import {
  buildAudioSearchDashboard,
  buildAudioPlayerDashboard,
} from '../../services/audio/audioDashboard.js';

import {
  searchYouTubeAudio,
} from '../../services/audio/audioYouTube.js';

import {
  ensurePlayer,
  startPlayback,
} from '../../services/music/musicActions.js';

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
      Number(
        track?.info?.length,
      ) || 0,

    thumbnail:
      track?.info?.artworkUrl ||
      track?.info?.thumbnail ||
      null,

    uri:
      track?.info?.uri ||
      null,
  };
}

function isPlayerIdle(player) {
  return Boolean(
    player &&
    !player.playing &&
    !player.paused &&
    !player.current,
  );
}

export default {
  data: new SlashCommandBuilder()
    .setName('audio')
    .setDescription(
      'Mở hệ thống Usagi Audio hoặc phát trực tiếp từ YouTube.',
    )
    .addStringOption(
      (option) =>
        option
          .setName('input')
          .setDescription(
            'Tên audio hoặc link YouTube',
          )
          .setRequired(false),
    ),

  async execute(
    interaction,
    guildConfig,
    client,
  ) {
    if (!interaction.guild) {
      return interaction.reply({
        content:
          '🌸 Lệnh này chỉ có thể sử dụng trong server.',
        ephemeral: true,
      });
    }

    /*
     * =====================================================
     * IMPORTANT
     * =====================================================
     *
     * Luôn lấy Discord client trực tiếp từ interaction.
     *
     * Không phụ thuộc vào tham số client được truyền
     * từ command loader.
     *
     * Điều này đảm bảo Audio luôn lấy đúng:
     *
     * interaction.client.riffy
     */

    const runtimeClient =
      interaction.client;

    if (!runtimeClient) {
      return interaction.reply({
        content:
          '🌸 Không thể kết nối với hệ thống bot.',
        ephemeral: true,
      });
    }

    const guildId =
      interaction.guild.id;

    const channelId =
      interaction.channelId;

    const session =
      audioManager.getOrCreateSession(
        guildId,
      );

    /*
     * =====================================================
     * AUDIO TEXT CHANNEL
     * =====================================================
     */

    if (
      session.audioChannelId &&
      !audioManager.isAllowedChannel(
        guildId,
        channelId,
      )
    ) {
      return interaction.reply({
        content:
          '🌸 Hệ thống Audio chỉ có thể sử dụng trong kênh Audio được thiết lập.',
        ephemeral: true,
      });
    }

    /*
     * =====================================================
     * INPUT
     * =====================================================
     */

    const input =
      interaction.options
        .getString('input')
        ?.trim();

    /*
     * =====================================================
     * NORMAL /audio
     * =====================================================
     */

    if (!input) {
      session.textChannelId =
        channelId;

      return interaction.reply(
        buildAudioSearchDashboard(),
      );
    }

    /*
     * =====================================================
     * DIRECT SEARCH / YOUTUBE URL
     * =====================================================
     */

    await interaction.deferReply();

    try {
      const results =
        await searchYouTubeAudio(
          runtimeClient,
          input,
        );

      /*
       * ===================================================
       * NO RESULTS
       * ===================================================
       */

      if (!results.length) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                '🌸 Usagi không tìm thấy audio',
              )
              .setDescription(
                [
                  'Usagi không tìm thấy video phù hợp trên **YouTube**.',
                  '',
                  '🔎 **Bạn đã nhập:**',
                  `> ${input}`,
                  '',
                  'Hãy kiểm tra lại link hoặc thử một từ khóa khác nhé ♡',
                ].join('\n'),
              )
              .setColor(
                0xffb6d9,
              ),
          ],

          components:
            buildAudioSearchDashboard()
              .components,
        });
      }

      const result =
        results[0];

      if (!result?.track) {
        throw new Error(
          'YouTube returned an invalid audio track.',
        );
      }

      /*
       * ===================================================
       * VOICE CHANNEL
       * ===================================================
       */

      const voiceChannel =
        interaction.member?.voice
          ?.channel;

      if (!voiceChannel) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                '🌸 Chưa vào voice channel',
              )
              .setDescription(
                'Bạn cần vào voice channel trước khi phát audio nhé ♡',
              )
              .setColor(
                0xed4245,
              ),
          ],

          components:
            buildAudioSearchDashboard()
              .components,
        });
      }

      /*
       * ===================================================
       * RIFFY PLAYER
       * ===================================================
       */

      const {
        player,
      } = await ensurePlayer(
        runtimeClient,
        interaction,
      );

      if (!player) {
        throw new Error(
          'Riffy player could not be created.',
        );
      }

      /*
       * ===================================================
       * MARK AUDIO TRACK
       * ===================================================
       */

      const track =
        result.track;

      track.info ??= {};

      track.info.__usagiAudio =
        true;

      track.info.requester =
        interaction.user;

      player.__usagiAudio =
        true;

      /*
       * ===================================================
       * SESSION
       * ===================================================
       */

      session.queue ??= [];

      session.voiceChannelId =
        voiceChannel.id;

      session.textChannelId =
        channelId;

      session.volume =
        Math.max(
          0,
          Math.min(
            100,
            Number(
              session.volume ?? 100,
            ),
          ),
        );

      const sessionTrack =
        createSessionTrack(
          track,
        );

      session.queue.push(
        sessionTrack,
      );

      session.lastSelectedTrack =
        sessionTrack;

      /*
       * ===================================================
       * ADD TO RIFFY QUEUE
       * ===================================================
       */

      player.queue.add(
        track,
      );

      player.setVolume(
        session.volume,
      );

      /*
       * ===================================================
       * START
       * ===================================================
       */

      const wasIdle =
        isPlayerIdle(
          player,
        );

      if (wasIdle) {
        await startPlayback(
          player,
        );
      }

      /*
       * ===================================================
       * CURRENT TRACK
       * ===================================================
       */

      const currentTrack =
        player.current ||
        (
          wasIdle
            ? track
            : null
        );

      if (currentTrack) {
        session.currentTrack =
          createSessionTrack(
            currentTrack,
          );
      }

      session.isPlaying =
        Boolean(
          player.playing,
        );

      session.isPaused =
        Boolean(
          player.paused,
        );

      /*
       * ===================================================
       * PLAYER DASHBOARD
       * ===================================================
       */

      if (currentTrack) {
        return interaction.editReply(
          buildAudioPlayerDashboard(
            currentTrack,
            player,
            session,
          ),
        );
      }

      if (player.current) {
        return interaction.editReply(
          buildAudioPlayerDashboard(
            player.current,
            player,
            session,
          ),
        );
      }

      throw new Error(
        `Audio was queued but playback did not start. Queue length: ${
          player.queue?.length || 0
        }`,
      );
    } catch (error) {
      console.error(
        '[USAGI AUDIO]',
        error,
      );

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              '🌸 Usagi chưa thể phát audio',
            )
            .setDescription(
              [
                'YouTube đã nhận được yêu cầu nhưng Lavalink chưa thể phát audio này.',
                '',
                `🔎 **${input}**`,
                '',
                `⚠️ ${
                  error?.message ||
                  'Unknown playback error'
                }`,
                '',
                'Bạn có thể thử một link YouTube khác hoặc dùng Search Audio.',
              ].join('\n'),
            )
            .setColor(
              0xed4245,
            ),
        ],

        components:
          buildAudioSearchDashboard()
            .components,
      });
    }
  },
};
