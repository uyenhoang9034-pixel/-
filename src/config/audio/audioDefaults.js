import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

import { AUDIO_DEFAULTS } from '../../config/audio/audioDefaults.js';

/**
 * =========================================================
 * USAGI AUDIO — DASHBOARD
 * PHASE 4
 * =========================================================
 *
 * Chỉ chỉnh giao diện.
 * Không thay đổi logic playback.
 * Không thay đổi customId.
 * Không thay đổi queue / Riffy.
 */

const USAGI_GIF =
  'https://i.pinimg.com/originals/95/c2/b3/95c2b36734919facb1e2682f387880d1.gif';

/**
 * =========================================================
 * SEARCH DASHBOARD
 * =========================================================
 */

export function buildAudioSearchEmbed() {
  const config = AUDIO_DEFAULTS.searchDashboard;

  const embed = new EmbedBuilder()
    .setTitle(
      config.title ||
        '🌸 Usagi Audio',
    )
    .setDescription(
      config.description ||
        'Tìm một câu chuyện, podcast hoặc audio mà bạn muốn nghe cùng Usagi nhé ♡',
    )
    .setColor(
      config.color ||
        0xffb6d9,
    );

  /*
   * Dùng GIF Usagi.
   * Nếu sau này config.image có giá trị thì ưu tiên config.
   */
  embed.setImage(
    config.image || USAGI_GIF,
  );

  return embed;
}

export function buildAudioSearchButtons() {
  const config =
    AUDIO_DEFAULTS.searchDashboard;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('audioSearch')
      .setLabel(
        config.searchButtonLabel ||
          'Search Audio',
      )
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary),
  );
}

export function buildAudioSearchDashboard() {
  return {
    embeds: [
      buildAudioSearchEmbed(),
    ],

    components: [
      buildAudioSearchButtons(),
    ],
  };
}

/**
 * =========================================================
 * PLAYER DASHBOARD
 * =========================================================
 */

export function buildAudioPlayerDashboard(
  track,
  player,
  session,
) {
  const config =
    AUDIO_DEFAULTS.playerDashboard;

  const title =
    track?.info?.title ||
    'Unknown Audio';

  const author =
    track?.info?.author ||
    'Unknown';

  const duration =
    Number(
      track?.info?.length,
    ) || 0;

  const position =
    Number(
      player?.position,
    ) || 0;

  const isPaused =
    Boolean(
      player?.paused,
    );

  const loopMode =
    session?.loopMode ||
    'none';

  const volume =
    Number(
      session?.volume ?? 100,
    );

  /**
   * -------------------------------------------------------
   * EMBED
   * -------------------------------------------------------
   */

  const embed =
    new EmbedBuilder()
      .setColor(
        config.color ||
          0xffb6d9,
      )
      .setTitle(
        config.title ||
          '🎧 Now Listening',
      );

  /**
   * -------------------------------------------------------
   * TRACK
   * -------------------------------------------------------
   */

  const description = [
    `🎵 **${title}**`,
    '',
    `👤 ${author}`,
    '',
    '🎀 **Progress**',
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
  ];

  embed.setDescription(
    description.join('\n'),
  );

  /**
   * -------------------------------------------------------
   * USAGI GIF
   * -------------------------------------------------------
   *
   * Dùng thumbnail thay vì setImage để GIF không chiếm
   * toàn bộ chiều ngang dashboard.
   */

  embed.setThumbnail(
    config.image || USAGI_GIF,
  );

  /**
   * Không dùng thumbnail YouTube nữa.
   * Dashboard luôn giữ hình ảnh Usagi.
   */

  return {
    embeds: [
      embed,
    ],

    components:
      buildAudioPlayerButtons(
        isPaused,
        loopMode,
      ),
  };
}

/**
 * =========================================================
 * PLAYER CONTROLS
 * =========================================================
 *
 * GIỮ NGUYÊN toàn bộ customId của Phase 3.
 */

export function buildAudioPlayerButtons(
  isPaused = false,
  loopMode = 'none',
) {
  /**
   * -------------------------------------------------------
   * ROW 1
   * -------------------------------------------------------
   */

  const firstRow =
    new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId(
          'audioPrevious',
        )
        .setEmoji('⏮️')
        .setStyle(
          ButtonStyle.Secondary,
        ),

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
        .setStyle(
          ButtonStyle.Primary,
        ),

      new ButtonBuilder()
        .setCustomId(
          'audioSkip',
        )
        .setEmoji('⏭️')
        .setStyle(
          ButtonStyle.Secondary,
        ),

      new ButtonBuilder()
        .setCustomId(
          'audioLoop',
        )
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
        .setCustomId(
          'audioStop',
        )
        .setEmoji('⏹️')
        .setStyle(
          ButtonStyle.Danger,
        ),
    );

  /**
   * -------------------------------------------------------
   * ROW 2
   * -------------------------------------------------------
   */

  const secondRow =
    new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId(
          'audioVolumeDown',
        )
        .setEmoji('🔉')
        .setStyle(
          ButtonStyle.Secondary,
        ),

      new ButtonBuilder()
        .setCustomId(
          'audioVolumeUp',
        )
        .setEmoji('🔊')
        .setStyle(
          ButtonStyle.Secondary,
        ),

      new ButtonBuilder()
        .setCustomId(
          'audioQueue',
        )
        .setEmoji('📜')
        .setLabel('Queue')
        .setStyle(
          ButtonStyle.Secondary,
        ),

      new ButtonBuilder()
        .setCustomId(
          'audioSearch',
        )
        .setEmoji('🔍')
        .setLabel('Search')
        .setStyle(
          ButtonStyle.Primary,
        ),
    );

  return [
    firstRow,
    secondRow,
  ];
}

/**
 * =========================================================
 * PROGRESS BAR
 * =========================================================
 */

function buildProgressBar(
  position,
  duration,
) {
  if (
    !duration ||
    duration <= 0
  ) {
    return '🔴 **LIVE / STREAM**';
  }

  const size = 20;

  const progress =
    Math.min(
      1,
      Math.max(
        0,
        position / duration,
      ),
    );

  const filled =
    Math.round(
      progress * size,
    );

  const empty =
    size - filled;

  return (
    '╰' +
    '━'.repeat(
      Math.max(
        0,
        filled,
      ),
    ) +
    (filled > 0
      ? '●'
      : '○') +
    '─'.repeat(
      Math.max(
        0,
        empty,
      ),
    ) +
    '╯'
  );
}

/**
 * =========================================================
 * FORMAT TIME
 * =========================================================
 */

export function formatTime(ms) {
  if (
    !ms ||
    ms <= 0
  ) {
    return '00:00';
  }

  const totalSeconds =
    Math.floor(
      ms / 1000,
    );

  const hours =
    Math.floor(
      totalSeconds / 3600,
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60,
    );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(
      minutes,
    ).padStart(
      2,
      '0',
    )}:${String(
      seconds,
    ).padStart(
      2,
      '0',
    )}`;
  }

  return `${String(
    minutes,
  ).padStart(
    2,
    '0',
  )}:${String(
    seconds,
  ).padStart(
    2,
    '0',
  )}`;
}

/**
 * =========================================================
 * LOOP MODE
 * =========================================================
 */

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

/**
 * =========================================================
 * NO RESULTS
 * =========================================================
 */

export function buildAudioNoResults(
  query,
) {
  const searchDashboard =
    buildAudioSearchDashboard();

  const embed =
    new EmbedBuilder()
      .setTitle(
        '🌸 Usagi không tìm thấy gì...',
      )
      .setDescription(
        [
          'Không tìm thấy audio phù hợp trên **YouTube**.',
          '',
          '🔎 **Từ khóa:**',
          `> ${query}`,
          '',
          'Thử tìm bằng từ khóa khác nhé ♡',
        ].join('\n'),
      )
      .setColor(
        AUDIO_DEFAULTS
          .searchDashboard
          .color ||
          0xffb6d9,
      )
      .setThumbnail(
        USAGI_GIF,
      );

  return {
    embeds: [
      embed,
    ],

    components:
      searchDashboard.components,
  };
}
