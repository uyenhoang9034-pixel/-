/**
 * =========================================================
 * USAGI AUDIO — YOUTUBE
 * =========================================================
 *
 * Hỗ trợ:
 *
 * /audio
 * → mở Search Audio
 *
 * /audio input:<từ khóa>
 * → tìm YouTube
 *
 * /audio input:<YouTube URL>
 * → resolve trực tiếp video YouTube
 *
 * Chỉ sử dụng Lavalink + Riffy hiện tại của bot.
 */

import {
  TitanBotError,
  ErrorTypes,
} from '../../utils/errorHandler.js';

const MAX_RESULTS = 10;
const MAX_QUERY_LENGTH = 200;

const YOUTUBE_URL_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)(?:\/|$)/i;

/**
 * =========================================================
 * GET REAL DISCORD CLIENT
 * =========================================================
 *
 * Có thể nhận:
 *
 * client
 *
 * hoặc:
 *
 * interaction
 *
 * hoặc:
 *
 * interaction.client
 *
 * để tránh lỗi Audio Lavalink unavailable
 * do truyền nhầm object.
 */

function getClient(source) {
  if (source?.riffy) {
    return source;
  }

  if (source?.client?.riffy) {
    return source.client;
  }

  if (source?.client) {
    return source.client;
  }

  return source;
}

/**
 * =========================================================
 * GET RIFFY
 * =========================================================
 */

function getRiffy(source) {
  const client =
    getClient(source);

  if (!client?.riffy) {
    throw new TitanBotError(
      'Audio Lavalink unavailable',
      ErrorTypes.CONFIGURATION,
      '🌸 Hệ thống Audio hiện không kết nối được với Lavalink.',
    );
  }

  return {
    client,
    riffy: client.riffy,
  };
}

/**
 * =========================================================
 * YOUTUBE URL
 * =========================================================
 */

export function isYouTubeUrl(
  query,
) {
  return YOUTUBE_URL_PATTERN.test(
    String(query || '').trim(),
  );
}

/**
 * =========================================================
 * SEARCH / RESOLVE
 * =========================================================
 */

export async function searchYouTubeAudio(
  source,
  query,
  requester = null,
) {
  const {
    riffy,
  } = getRiffy(source);

  const cleanQuery =
    String(query || '').trim();

  if (!cleanQuery) {
    throw new TitanBotError(
      'Empty audio query',
      ErrorTypes.USER_INPUT,
      '🌸 Bạn chưa nhập nội dung cần tìm.',
    );
  }

  if (
    cleanQuery.length >
    MAX_QUERY_LENGTH
  ) {
    throw new TitanBotError(
      'Audio query too long',
      ErrorTypes.USER_INPUT,
      '🌸 Nội dung tìm kiếm quá dài.',
    );
  }

  const directUrl =
    isYouTubeUrl(
      cleanQuery,
    );

  /*
   * =======================================================
   * RESOLVE QUERY
   * =======================================================
   *
   * URL YouTube:
   *
   *     https://youtu.be/xxxxx
   *
   * → resolve trực tiếp.
   *
   * Từ khóa:
   *
   *     ytsearch:từ khóa
   *
   * → YouTube search.
   */

  const resolveQuery =
    directUrl
      ? cleanQuery
      : `ytsearch:${cleanQuery}`;

  const result =
    await riffy.resolve({
      query:
        resolveQuery,

      requester,
    });

  const loadType =
    String(
      result?.loadType ||
        '',
    ).toUpperCase();

  /*
   * =======================================================
   * NO MATCH
   * =======================================================
   */

  if (
    loadType === 'NO_MATCHES' ||
    loadType === 'NO_MATCH' ||
    loadType === 'EMPTY'
  ) {
    return [];
  }

  /*
   * =======================================================
   * GET TRACKS
   * =======================================================
   */

  let tracks =
    Array.isArray(
      result?.tracks,
    )
      ? result.tracks
      : [];

  /*
   * =======================================================
   * DIRECT YOUTUBE URL
   * =======================================================
   *
   * Chỉ lấy đúng video đầu tiên.
   *
   * Không tự động lấy playlist.
   */

  if (directUrl) {
    const track =
      tracks.find(
        (item) => {
          const uri =
            item?.info?.uri ||
            '';

          return /(?:youtube\.com|youtu\.be)/i.test(
            uri,
          );
        },
      );

    if (!track) {
      return [];
    }

    tracks = [
      track,
    ];
  } else {
    /*
     * =====================================================
     * SEARCH RESULTS
     * =====================================================
     *
     * Chỉ giữ kết quả YouTube.
     */

    tracks =
      tracks
        .filter(
          (track) => {
            const uri =
              track?.info?.uri ||
              '';

            return /(?:youtube\.com|youtu\.be)/i.test(
              uri,
            );
          },
        )
        .slice(
          0,
          MAX_RESULTS,
        );
  }

  /*
   * =======================================================
   * NORMALIZE
   * =======================================================
   */

  return tracks.map(
    (
      track,
      index,
    ) => ({
      index,

      title:
        track?.info?.title ||
        'Unknown YouTube video',

      author:
        track?.info?.author ||
        'Unknown',

      uri:
        track?.info?.uri ||
        null,

      duration:
        Number(
          track?.info?.length,
        ) || 0,

      thumbnail:
        track?.info?.artworkUrl ||
        track?.info?.thumbnail ||
        null,

      isStream:
        Boolean(
          track?.info?.isStream,
        ),

      track,
    }),
  );
}

/**
 * =========================================================
 * FORMAT DURATION
 * =========================================================
 */

export function formatAudioDuration(
  milliseconds,
) {
  if (
    !milliseconds ||
    milliseconds <= 0
  ) {
    return 'Live';
  }

  const totalSeconds =
    Math.floor(
      milliseconds / 1000,
    );

  const hours =
    Math.floor(
      totalSeconds / 3600,
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
        60,
    );

  const seconds =
    totalSeconds % 60;

  if (
    hours > 0
  ) {
    return (
      `${hours}:` +
      `${String(
        minutes,
      ).padStart(
        2,
        '0',
      )}:` +
      `${String(
        seconds,
      ).padStart(
        2,
        '0',
      )}`
    );
  }

  return (
    `${minutes}:` +
    `${String(
      seconds,
    ).padStart(
      2,
      '0',
    )}`
  );
}

export default {
  searchYouTubeAudio,
  isYouTubeUrl,
  formatAudioDuration,
};
