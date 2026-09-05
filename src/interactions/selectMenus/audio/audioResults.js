import {
  EmbedBuilder,
} from 'discord.js';

import { once } from 'node:events';

import audioManager from '../../../services/audio/audioManager.js';

import {
  ensurePlayer,
} from '../../../services/music/musicActions.js';

import {
  formatAudioDuration,
} from '../../../services/audio/audioYouTube.js';

import {
  buildAudioPlayerDashboard,
} from '../../../services/audio/audioDashboard.js';


const PLAYER_CONNECT_TIMEOUT_MS = 12_000;


/**
 * Wait until Riffy has successfully established
 * the Discord voice connection.
 *
 * This follows the same connection flow used
 * by the existing Music system.
 */
async function waitForPlayerConnection(player) {
  /*
   * Already connected.
   */
  if (player.connected) {
    return;
  }

  /*
   * Ask Riffy to resolve the connection first.
   */
  try {
    await player.connection.resolve();
  } catch {
    /*
     * If resolve() does not immediately complete,
     * wait for Riffy's connection event below.
     */
  }

  if (player.connected) {
    return;
  }

  /*
   * Wait for Lavalink/Riffy to confirm
   * that the voice connection is ready.
   */
  try {
    await once(
      player,
      'connectionRestored',
      {
        signal: AbortSignal.timeout(
          PLAYER_CONNECT_TIMEOUT_MS,
        ),
      },
    );
  } catch {
    /*
     * Timeout is handled below.
     */
  }

  if (!player.connected) {
    throw new Error(
      'Usagi chưa thể kết nối vào voice channel. Hãy kiểm tra quyền Connect/Speak của bot rồi thử lại.',
    );
  }
}


/**
 * Start playback only after the voice connection
 * has been established.
 */
async function startAudioPlayback(player) {
  await waitForPlayerConnection(player);

  await player.play();
}


/**
 * Convert a Riffy track into the format used
 * by the Audio session.
 */
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
     * Validate selected search result.
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
     * User must be inside a voice channel.
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
       * Reuse the existing Riffy player system.
       *
       * ensurePlayer() is also used by the
       * existing Music system.
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
       * Save requester information.
       */
      if (track.info) {
        track.info.requester =
          interaction.user;
      }

      /*
       * Store Audio queue separately from
       * the existing Music data.
       */
      session.queue ??= [];

      session.queue.push(
        createSessionTrack(track),
      );

      /*
       * Add track to Riffy queue.
       */
      player.queue.add(
        track,
      );

      /*
       * Store current voice/text channel.
       */
      session.voiceChannelId =
        voiceChannel.id;

      session.textChannelId =
        interaction.channelId;

      /*
       * Keep volume synchronized.
       */
      session.volume =
        Number(
          session.volume ?? 100,
        );

      player.setVolume(
        session.volume,
      );

      /*
       * Check whether player is idle.
       *
       * If it is idle, this selected track
       * should become the current track.
       */
      const shouldStart =
        !player.playing &&
        !player.paused &&
        !player.current;

      if (shouldStart) {
        /*
         * IMPORTANT:
         *
         * Wait for the Discord voice connection
         * before calling player.play().
         */
        await startAudioPlayback(
          player,
        );
      }

      /*
       * Riffy normally sets player.current
       * immediately after playback begins.
       *
       * In case it has not updated yet, use
       * the selected track as temporary fallback.
       */
      const currentTrack =
        player.current ||
        track;

      const sessionTrack =
        createSessionTrack(
          currentTrack,
        );

      session.currentTrack =
        sessionTrack;

      session.isPlaying =
        true;

      session.isPaused =
        false;

      /*
       * Show the actual Usagi Audio Player.
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
                'Hãy đảm bảo bot có quyền **Connect** và **Speak** trong voice channel nhé ♡',
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
