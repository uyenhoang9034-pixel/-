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
 * =========================================================
 *
 * Phase 4
 *
 * Chỉ xử lý giao diện.
 * Không thay đổi logic playback.
 * Không thay đổi Riffy.
 * Không thay đổi Music system.
 */

/**
 * =========================================================
 * SEARCH DASHBOARD
 * =========================================================
 */

export function buildAudioSearchEmbed() {
  const config =
    AUDIO_DEFAULTS.searchDashboard;

  const embed =
    new EmbedBuilder()
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
   * GIF Usagi
   */
  if (config.image) {
    embed.setImage(
      config.image,
    );
  }

  if (
    config.showFooter !== false &&
    config.footer
  ) {
    embed.setFooter({
      text: config.footer,
    });
  }

  return embed;
}

export function buildAudioSearchButtons() {
  const config =
    AUDIO_DEFAULTS.searchDashboard;

  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          'audioSearch',
        )
        .setLabel(
          config.searchButtonLabel ||
            'Search Audio',
        )
        .setEmoji(
          config.searchButtonEmoji ||
            '🔍',
        )
        .setStyle(
          ButtonStyle.Primary,
        ),
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
    Math.max(
      0,
      Math.min(
        100,
        Number(
          session?.volume ??
            100,
        ),
      ),
    );

  /**
   * -------------------------------------------------------
   * MAIN EMBED
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
   * TRACK TITLE
   * -------------------------------------------------------
   */

  embed.setDescription(
    [
      '🎵 **' + title + '**',
      '',
      config.description ||
        'Usagi đang cùng bạn lắng nghe ♡',
    ].join('\n'),
  );

  /**
   * -------------------------------------------------------
   * AUTHOR
   * -------------------------------------------------------
   */

  if (
    config.showAuthor !== false
  ) {
    embed.addFields({
      name: '👤 Artist',
      value:
        author ||
        'Unknown',
      inline: true,
    });
  }

  /**
   * -------------------------------------------------------
   * REQUESTER
   * -------------------------------------------------------
   */

  const requester =
    session?.requester ||
    track?.info?.requester;

  if (requester) {
    embed.addFields({
      name: '💗 Requester',
      value:
        requester?.username ||
        requester?.displayName ||
        String(requester),
      inline: true,
    });
  }

  /**
   * -------------------------------------------------------
   * PROGRESS
   * -------------------------------------------------------
   */

  if (
    config.showProgress !== false
  ) {
    embed.addFields({
      name: '🎀 Progress',
      value: [
        buildProgressBar(
          position,
          duration,
        ),
        '',
        `\`${formatTime(position)} / ${formatTime(duration)}\``,
      ].join('\n'),
      inline: false,
    });
  }

  /**
   * -------------------------------------------------------
   * VOLUME
   * -------------------------------------------------------
   */

  if (
    config.showVolume !== false
  ) {
    embed.addFields({
      name: '🔊 Volume',
      value:
        `**${volume}%**`,
      inline: true,
    });
  }

  /**
   * -------------------------------------------------------
   * LOOP
   * -------------------------------------------------------
   */

  if (
    config.showLoop !== false
  ) {
    embed.addFields({
      name: '🔁 Loop',
      value:
        `**${formatLoopMode(loopMode)}**`,
      inline: true,
    });
  }

  /**
   * -------------------------------------------------------
   * QUEUE
   * -------------------------------------------------------
   */

  if (
    config.showQueue !== false
  ) {
    const queueLength =
      Number(
        player?.queue?.length,
      ) || 0;

    embed.addFields({
      name: '📜 Queue',
      value:
        `**${queueLength}** track(s)`,
      inline: true,
    });
  }

  /**
   * -------------------------------------------------------
   * STATUS
   * -------------------------------------------------------
   */

  if (
    config.showStatus !== false
  ) {
    embed.addFields({
      name: '🌸 Status',
      value:
        isPaused
          ? '⏸️ **Đang tạm dừng**'
          : '▶️ **Đang phát**',
      inline: false,
    });
  }

  /**
   * -------------------------------------------------------
   * USAGI GIF
   * -------------------------------------------------------
   *
   * GIF được đặt ở thumbnail để không chiếm toàn bộ
   * dashboard.
   */

  if (config.image) {
    embed.setThumbnail(
      config.image,
    );
  }

  /**
   * -------------------------------------------------------
   * YOUTUBE THUMBNAIL
   * -------------------------------------------------------
   */

  const artwork =
    track?.info?.artworkUrl ||
    track?.info?.thumbnail ||
    null;

  /*
   * Artwork YouTube chỉ dùng khi không có GIF Usagi.
   *
   * Như vậy dashboard không bị artwork YouTube
   * đè lên hình Usagi.
   */
  if (
    artwork &&
    !config.image
  ) {
    embed.setThumbnail(
      artwork,
    );
  }

  /**
   * -------------------------------------------------------
   * FOOTER
   * -------------------------------------------------------
   */

  if (
    config.showFooter !== false &&
    config.footer
  ) {
    embed.setFooter({
      text:
        config.footer,
    });
  }

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
 * PLAYER BUTTONS
 * =========================================================
 */

export function buildAudioPlayerButtons(
  isPaused = false,
  loopMode = 'none',
) {
  const config =
    AUDIO_DEFAULTS.playerButtons;

  /**
   * -------------------------------------------------------
   * ROW 1
   * -------------------------------------------------------
   */

  const firstRow =
    new ActionRowBuilder()
      .addComponents(

        /*
         * Previous
         */
        new ButtonBuilder()
          .setCustomId(
            'audioPrevious',
          )
          .setLabel(
            config?.previous?.label ||
              'Previous',
          )
          .setEmoji(
            config?.previous?.emoji ||
              '⏮️',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /*
         * Pause / Resume
         */
        new ButtonBuilder()
          .setCustomId(
            isPaused
              ? 'audioResume'
              : 'audioPause',
          )
          .setLabel(
            isPaused
              ? (
                config?.resume?.label ||
                'Resume'
              )
              : (
                config?.pause?.label ||
                'Pause'
              ),
          )
          .setEmoji(
            isPaused
              ? (
                config?.resume?.emoji ||
                '▶️'
              )
              : (
                config?.pause?.emoji ||
                '⏸️'
              ),
          )
          .setStyle(
            ButtonStyle.Primary,
          ),

        /*
         * Skip
         */
        new ButtonBuilder()
          .setCustomId(
            'audioSkip',
          )
          .setLabel(
            config?.skip?.label ||
              'Skip',
          )
          .setEmoji(
            config?.skip?.emoji ||
              '⏭️',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /*
         * Loop
         */
        new ButtonBuilder()
          .setCustomId(
            'audioLoop',
          )
          .setLabel(
            config?.loop?.label ||
              'Loop',
          )
          .setEmoji(
            loopMode === 'none'
              ? (
                config?.loop?.emoji ||
                '🔁'
              )
              : (
                config?.loopActive?.emoji ||
                '🔂'
              ),
          )
          .setStyle(
            loopMode === 'none'
              ? ButtonStyle.Secondary
              : ButtonStyle.Success,
          ),

        /*
         * Stop
         */
        new ButtonBuilder()
          .setCustomId(
            'audioStop',
          )
          .setLabel(
            config?.stop?.label ||
              'Stop',
          )
          .setEmoji(
            config?.stop?.emoji ||
              '⏹️',
          )
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
    new ActionRowBuilder()
      .addComponents(

        /*
         * Volume -
         */
        new ButtonBuilder()
          .setCustomId(
            'audioVolumeDown',
          )
          .setLabel(
            config?.volumeDown?.label ||
              'Volume -',
          )
          .setEmoji(
            config?.volumeDown?.emoji ||
              '🔉',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /*
         * Volume +
         */
        new ButtonBuilder()
          .setCustomId(
            'audioVolumeUp',
          )
          .setLabel(
            config?.volumeUp?.label ||
              'Volume +',
          )
          .setEmoji(
            config?.volumeUp?.emoji ||
              '🔊',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /*
         * Queue
         */
        new ButtonBuilder()
          .setCustomId(
            'audioQueue',
          )
          .setLabel(
            config?.queue?.label ||
              'Queue',
          )
          .setEmoji(
            config?.queue?.emoji ||
              '📜',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /*
         * Search
         */
        new ButtonBuilder()
          .setCustomId(
            'audioSearch',
          )
          .setLabel(
            config?.search?.label ||
              'Search',
          )
          .setEmoji(
            config?.search?.emoji ||
              '🔍',
          )
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

  return [
    '╰',
    '━'.repeat(
      Math.max(
        0,
        filled,
      ),
    ),
    filled > 0
      ? '●'
      : '○',
    '─'.repeat(
      Math.max(
        0,
        empty,
      ),
    ),
    '╮',
  ].join('');
}

/**
 * =========================================================
 * TIME
 * =========================================================
 */

export function formatTime(
  ms,
) {
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
      (
        totalSeconds % 3600
      ) / 60,
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

function formatLoopMode(
  mode,
) {
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
  const config =
    AUDIO_DEFAULTS.searchDashboard;

  const embed =
    new EmbedBuilder()
      .setTitle(
        '🌸 Usagi không tìm thấy gì...',
      )
      .setDescription(
        [
          'Không tìm thấy audio phù hợp trên **YouTube**.',
          '',
          '🔎 **Từ khóa**',
          `> ${query}`,
          '',
          'Thử tìm bằng từ khóa khác nhé ♡',
        ].join('\n'),
      )
      .setColor(
        config.color ||
          0xffb6d9,
      );

  if (config.image) {
    embed.setThumbnail(
      config.image,
    );
  }

  if (
    config.showFooter !== false &&
    config.footer
  ) {
    embed.setFooter({
      text:
        config.footer,
    });
  }

  return {
    embeds: [
      embed,
    ],

    components: [
      buildAudioSearchButtons(),
    ],
  };
}
