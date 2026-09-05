import {
  EmbedBuilder,
} from 'discord.js';

import audioManager from '../../../services/audio/audioManager.js';

import {
  getPlayer,
} from '../../../services/music/musicActions.js';

import {
  canControlMusic,
} from '../../../services/music/permissions.js';

import {
  buildAudioPlayerDashboard,
} from '../../../services/audio/audioDashboard.js';

export default {
  name: 'audioPlayerButtons',

  async execute(interaction, client) {
    const customId = interaction.customId;

    const session =
      audioManager.getSession(
        interaction.guildId,
      );

    if (!session) {
      return interaction.reply({
        content:
          '🌸 Audio session đã hết hạn. Hãy dùng `/audio` để bắt đầu lại nhé.',
        ephemeral: true,
      });
    }

    const player =
      getPlayer(
        client,
        interaction.guildId,
      );

    if (!player) {
      return interaction.reply({
        content:
          '🌸 Hiện tại không có audio nào đang phát.',
        ephemeral: true,
      });
    }

    if (!player.current) {
      return interaction.reply({
        content:
          '🌸 Hiện tại không có audio nào đang phát.',
        ephemeral: true,
      });
    }

    if (!interaction.member?.voice?.channel) {
      return interaction.reply({
        content:
          '🌸 Bạn cần ở trong voice channel để điều khiển Audio.',
        ephemeral: true,
      });
    }

    if (
      !canControlMusic(
        interaction.member,
        player,
      )
    ) {
      return interaction.reply({
        content:
          '🌸 Bạn cần ở cùng voice channel với Usagi để điều khiển Audio.',
        ephemeral: true,
      });
    }

    await interaction.deferUpdate();

    try {
      switch (customId) {
        case 'audioPause': {
          if (!player.paused) {
            player.pause(true);

            session.isPaused = true;
            session.isPlaying = false;
          }

          break;
        }

        case 'audioResume': {
          if (player.paused) {
            player.pause(false);

            session.isPaused = false;
            session.isPlaying = true;
          }

          break;
        }

        case 'audioSkip': {
          return await handleSkip(
            interaction,
            player,
            session,
          );
        }

        case 'audioPrevious': {
          return await handlePrevious(
            interaction,
            player,
            session,
          );
        }

        case 'audioLoop': {
          toggleLoop(
            player,
            session,
          );

          break;
        }

        case 'audioStop': {
          await stopAudio(
            player,
            session,
          );

          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('🌸 Usagi Audio')
                .setDescription(
                  '⏹️ Audio đã dừng.\n\nHẹn bạn lần sau nhé ♡',
                )
                .setColor(0xffb6d9),
            ],
            components: [],
          });
        }

        case 'audioVolumeDown': {
          session.volume =
            Math.max(
              0,
              (session.volume ?? 100) - 10,
            );

          player.setVolume(
            session.volume,
          );

          break;
        }

        case 'audioVolumeUp': {
          session.volume =
            Math.min(
              100,
              (session.volume ?? 100) + 10,
            );

          player.setVolume(
            session.volume,
          );

          break;
        }

        case 'audioQueue': {
          return interaction.editReply({
            embeds: [
              buildQueueEmbed(
                session,
                player,
              ),
            ],
            components: [],
          });
        }

        default:
          break;
      }

      if (!player.current) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🌸 Usagi Audio')
              .setDescription(
                'Không còn audio nào đang phát.',
              )
              .setColor(0xffb6d9),
          ],
          components: [],
        });
      }

      return interaction.editReply(
        buildAudioPlayerDashboard(
          player.current,
          player,
          session,
        ),
      );
    } catch (error) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🌸 Audio Error')
            .setDescription(
              [
                'Usagi không thể thực hiện thao tác này.',
                '',
                `> ${error?.message || 'Unknown error'}`,
              ].join('\n'),
            )
            .setColor(0xed4245),
        ],
        components: [],
      });
    }
  },
};


/* =========================================================
 * SKIP
 * ========================================================= */

async function handleSkip(
  interaction,
  player,
  session,
) {
  const nextTrack =
    player.queue?.[0];

  /*
   * Không có track tiếp theo.
   *
   * Không stop player ở đây.
   * Nếu stop khi queue rỗng, Riffy sẽ đi vào queueEnd
   * và hệ thống Music hiện tại có thể dọn player.
   */
  if (!nextTrack) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌸 Không có audio tiếp theo')
          .setDescription(
            [
              'Queue hiện đang trống.',
              '',
              'Hãy tìm thêm audio để Usagi phát tiếp nhé ♡',
            ].join('\n'),
          )
          .setColor(0xffb6d9),
      ],
      components:
        buildAudioPlayerDashboard(
          player.current,
          player,
          session,
        ).components,
    });
  }

  /*
   * Track-loop phải được tắt tạm thời,
   * nếu không Skip có thể quay lại chính track hiện tại.
   */
  if (player.loop === 'track') {
    player.setLoop('none');
  }

  /*
   * Lưu track hiện tại vào history trước khi skip.
   */
  if (player.current) {
    session.history ??= [];

    session.history.push(
      player.current,
    );

    if (session.history.length > 20) {
      session.history.shift();
    }
  }

  /*
   * stop() sẽ kích hoạt quá trình chuyển
   * sang track tiếp theo trong Riffy.
   */
  player.stop();

  session.isPlaying = true;
  session.isPaused = false;

  /*
   * QUAN TRỌNG:
   *
   * Không edit dashboard ngay lập tức.
   *
   * Chờ trackStart của Riffy cập nhật player.current.
   */
  const nextStarted =
    await waitForNextTrack(
      player,
      5000,
    );

  if (!nextStarted) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌸 Usagi Audio')
          .setDescription(
            [
              'Usagi đã chuyển sang audio tiếp theo',
              'nhưng Lavalink chưa phản hồi kịp.',
              '',
              'Hãy đợi một chút nhé ♡',
            ].join('\n'),
          )
          .setColor(0xffb6d9),
      ],
      components: [],
    });
  }

  session.currentTrack = {
    track: player.current,
    title:
      player.current.info?.title ||
      'Unknown Audio',
    author:
      player.current.info?.author ||
      'Unknown',
    duration:
      player.current.info?.length ||
      0,
    thumbnail:
      player.current.info?.artworkUrl ||
      player.current.info?.thumbnail ||
      null,
  };

  return interaction.editReply(
    buildAudioPlayerDashboard(
      player.current,
      player,
      session,
    ),
  );
}


/* =========================================================
 * PREVIOUS
 * ========================================================= */

async function handlePrevious(
  interaction,
  player,
  session,
) {
  const previous =
    session.history?.pop();

  if (!previous) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌸 Chưa có audio trước đó')
          .setDescription(
            'Usagi chưa có lịch sử audio để quay lại ♡',
          )
          .setColor(0xffb6d9),
      ],
      components:
        buildAudioPlayerDashboard(
          player.current,
          player,
          session,
        ).components,
    });
  }

  /*
   * Đưa track hiện tại trở lại đầu queue.
   */
  if (player.current) {
    player.queue.unshift(
      player.current,
    );
  }

  /*
   * Đưa previous lên đầu queue.
   */
  player.queue.unshift(
    previous,
  );

  /*
   * Tắt loop track tạm thời để Previous
   * không bị lặp sai.
   */
  if (player.loop === 'track') {
    player.setLoop('none');
  }

  player.stop();

  session.currentTrack = {
    track: previous,
    title:
      previous.info?.title ||
      'Unknown Audio',
    author:
      previous.info?.author ||
      'Unknown',
    duration:
      previous.info?.length ||
      0,
    thumbnail:
      previous.info?.artworkUrl ||
      previous.info?.thumbnail ||
      null,
  };

  session.isPlaying = true;
  session.isPaused = false;

  const previousStarted =
    await waitForNextTrack(
      player,
      5000,
    );

  if (!previousStarted) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌸 Usagi Audio')
          .setDescription(
            'Usagi chưa thể quay lại audio trước đó.',
          )
          .setColor(0xffb6d9),
      ],
      components: [],
    });
  }

  return interaction.editReply(
    buildAudioPlayerDashboard(
      player.current,
      player,
      session,
    ),
  );
}


/* =========================================================
 * WAIT FOR RIFFY
 * ========================================================= */

function waitForNextTrack(
  player,
  timeout = 5000,
) {
  return new Promise((resolve) => {
    if (player.current) {
      resolve(true);
      return;
    }

    let finished = false;

    const cleanup = () => {
      if (finished) {
        return;
      }

      finished = true;

      clearTimeout(timer);

      try {
        player.removeListener(
          'trackStart',
          onTrackStart,
        );
      } catch {
        // Ignore cleanup errors.
      }
    };

    const onTrackStart = () => {
      cleanup();
      resolve(true);
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(Boolean(player.current));
    }, timeout);

    player.once(
      'trackStart',
      onTrackStart,
    );
  });
}


/* =========================================================
 * LOOP
 * ========================================================= */

function toggleLoop(
  player,
  session,
) {
  const current =
    session.loopMode ||
    'none';

  let next;

  if (current === 'none') {
    next = 'track';
  } else if (current === 'track') {
    next = 'queue';
  } else {
    next = 'none';
  }

  session.loopMode = next;

  player.setLoop(next);
}


/* =========================================================
 * STOP
 * ========================================================= */

async function stopAudio(
  player,
  session,
) {
  player.setLoop('none');

  player.queue.clear();

  player.stop();

  session.currentTrack = null;
  session.searchResults = [];
  session.history = [];
  session.queue = [];
  session.isPlaying = false;
  session.isPaused = false;
}


/* =========================================================
 * QUEUE
 * ========================================================= */

function buildQueueEmbed(
  session,
  player,
) {
  const queue =
    player?.queue || [];

  const lines = [];

  if (player?.current) {
    lines.push(
      `🎧 **Đang phát:** ${
        player.current.info?.title ||
        'Unknown'
      }`,
    );

    lines.push('');
  }

  if (!queue.length) {
    lines.push(
      '📭 Queue hiện đang trống.',
    );
  } else {
    queue
      .slice(0, 10)
      .forEach(
        (track, index) => {
          lines.push(
            `${index + 1}. ${
              track.info?.title ||
              'Unknown'
            }`,
          );
        },
      );
  }

  return new EmbedBuilder()
    .setTitle('📜 Usagi Audio Queue')
    .setDescription(
      lines.join('\n'),
    )
    .setColor(0xffb6d9);
}
