import {
  EmbedBuilder,
} from 'discord.js';

import audioManager from '../../../services/audio/audioManager.js';

import {
  getPlayer,
  assertCanControl,
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
    const customId =
      interaction.customId;

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

    if (
      !interaction.member?.voice?.channel
    ) {
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
          await skipAudio(
            player,
            session,
          );

          break;
        }

        case 'audioPrevious': {
          await previousAudio(
            player,
            session,
          );

          break;
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
              session.volume - 10,
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
              session.volume + 10,
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

      if (
        !player.current
      ) {
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

async function skipAudio(
  player,
  session,
) {
  if (
    player.loop === 'track'
  ) {
    player.setLoop('none');
  }

  player.stop();

  session.isPlaying = true;
  session.isPaused = false;
}

async function previousAudio(
  player,
  session,
) {
  const previous =
    session.history?.pop();

  if (!previous) {
    return;
  }

  if (
    player.current
  ) {
    player.queue.unshift(
      player.current,
    );
  }

  player.queue.unshift(
    previous,
  );

  player.stop();

  session.currentTrack =
    previous;

  session.isPlaying = true;
  session.isPaused = false;
}

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
  } else if (
    current === 'track'
  ) {
    next = 'queue';
  } else {
    next = 'none';
  }

  session.loopMode = next;

  player.setLoop(next);
}

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

function buildQueueEmbed(
  session,
  player,
) {
  const queue =
    player?.queue || [];

  const lines = [];

  if (player?.current) {
    lines.push(
      `🎧 **Đang phát:** ${player.current.info?.title || 'Unknown'}`,
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
            `${index + 1}. ${track.info?.title || 'Unknown'}`,
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
