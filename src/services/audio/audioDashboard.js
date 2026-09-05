import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

import { AUDIO_DEFAULTS } from '../../config/audio/audioDefaults.js';

export function buildAudioSearchEmbed() {
  const config = AUDIO_DEFAULTS.searchDashboard;

  const embed = new EmbedBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setColor(config.color);

  if (config.image) {
    embed.setImage(config.image);
  }

  return embed;
}

export function buildAudioSearchButtons() {
  const config = AUDIO_DEFAULTS.searchDashboard;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('audioSearch')
      .setLabel(config.searchButtonLabel)
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary),
  );
}

export function buildAudioSearchDashboard() {
  return {
    embeds: [buildAudioSearchEmbed()],
    components: [buildAudioSearchButtons()],
  };
}

/**
 * Main Usagi Audio player dashboard.
 */
export function buildAudioPlayerDashboard(
  track,
  player,
  session,
) {
  const config = AUDIO_DEFAULTS.playerDashboard;

  const title =
    track?.info?.title ||
    'Unknown Audio';

  const author =
    track?.info?.author ||
    'Unknown';

  const duration =
    Number(track?.info?.length) || 0;

  const position =
    Number(player?.position) || 0;

  const isPaused =
    Boolean(player?.paused);

  const loopMode =
    session?.loopMode || 'none';

  const volume =
    Number(session?.volume ?? 100);

  const embed = new EmbedBuilder()
    .setTitle(config.title)
    .setDescription(
      [
        `🎧 **${title}**`,
        '',
        `👤 ${author}`,
        '',
        buildProgressBar(
          position,
          duration,
        ),
        '',
        `\`${formatTime(position)} / ${formatTime(duration)}\``,
        '',
        `🔊 Volume: **${volume}%**`,
        `🔁 Loop: **${formatLoopMode(loopMode)}**`,
        '',
        isPaused
          ? '⏸️ **Đang tạm dừng**'
          : '▶️ **Đang phát**',
      ].join('\n'),
    )
    .setColor(config.color);

  const thumbnail =
    track?.info?.artworkUrl ||
    track?.info?.thumbnail ||
    null;

  if (thumbnail) {
    embed.setImage(thumbnail);
  }

  return {
    embeds: [embed],
    components: buildAudioPlayerButtons(
      isPaused,
      loopMode,
    ),
  };
}

/**
 * Player controls.
 */
export function buildAudioPlayerButtons(
  isPaused = false,
  loopMode = 'none',
) {
  const firstRow =
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('audioPrevious')
        .setEmoji('⏮️')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(
          isPaused
            ? 'audioResume'
            : 'audioPause',
        )
        .setEmoji(
          isPaused
            ? '▶️'
            : '⏸️',
        )
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('audioSkip')
        .setEmoji('⏭️')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('audioLoop')
        .setEmoji(
          loopMode === 'none'
            ? '🔁'
            : '🔂',
        )
        .setStyle(
          loopMode === 'none'
            ? ButtonStyle.Secondary
            : ButtonStyle.Success,
        ),

      new ButtonBuilder()
        .setCustomId('audioStop')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Danger),
    );

  const secondRow =
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('audioVolumeDown')
        .setEmoji('🔉')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('audioVolumeUp')
        .setEmoji('🔊')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('audioQueue')
        .setEmoji('📜')
        .setLabel('Queue')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('audioSearch')
        .setEmoji('🔍')
        .setLabel('Search')
        .setStyle(ButtonStyle.Primary),
    );

  return [
    firstRow,
    secondRow,
  ];
}

/**
 * Build progress bar.
 */
function buildProgressBar(
  position,
  duration,
) {
  if (
    !duration ||
    duration <= 0
  ) {
    return '🔴 Live / Stream';
  }

  const size = 18;

  const progress = Math.min(
    1,
    Math.max(
      0,
      position / duration,
    ),
  );

  const filled = Math.round(
    progress * size,
  );

  return (
    '▰'.repeat(filled) +
    '▱'.repeat(size - filled)
  );
}

/**
 * Format milliseconds.
 */
export function formatTime(ms) {
  if (
    !ms ||
    ms <= 0
  ) {
    return '00:00';
  }

  const totalSeconds =
    Math.floor(ms / 1000);

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60,
    );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatLoopMode(mode) {
  switch (mode) {
    case 'track':
      return 'Track';

    case 'queue':
      return 'Queue';

    default:
      return 'Off';
  }
}

export function buildAudioNoResults(query) {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('🌸 Usagi không tìm thấy gì...')
        .setDescription(
          [
            'Không tìm thấy audio phù hợp trên **YouTube**.',
            '',
            '🔎 Từ khóa:',
            `> **${query}**`,
            '',
            'Thử tìm bằng từ khóa khác nhé ♡',
          ].join('\n'),
        )
        .setColor(
          AUDIO_DEFAULTS.searchDashboard.color,
        ),
    ],
    components: [],
  };
}
