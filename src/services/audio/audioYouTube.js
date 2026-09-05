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
 * → phát trực tiếp đúng video YouTube
 *
 * Không tự động lấy playlist.
 * Mỗi link YouTube chỉ lấy 1 video.
 *
 * Chỉ sử dụng Lavalink + Riffy hiện tại của bot.
 */

import {
  TitanBotError,
  ErrorTypes,
} from '../../utils/errorHandler.js';

const MAX_RESULTS = 10;
const MAX_QUERY_LENGTH = 200;

/**
 * YouTube URL.
 *
 * Hỗ trợ:
 *
 * https://youtube.com/watch?v=...
 * https://www.youtube.com/watch?v=...
 * https://youtu.be/...
 * https://youtube.com/shorts/...
 * http://...
 */
const YOUTUBE_URL_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)(?:\/|$)/i;

/**
 * =========================================================
 * GET REAL DISCORD CLIENT
 * =========================================================
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

export function isYouTubeUrl(query) {
  return YOUTUBE_URL_PATTERN.test(
    String(query || '').trim(),
  );
}

/**
 * =========================================================
 * SEARCH / RESOLVE YOUTUBE
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

  /**
   * =======================================================
   * RESOLVE QUERY
   * =======================================================
   *
   * Link:
   *
   *     https://youtu.be/xxxx
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

  let result;

  try {
    result =
      await riffy.resolve({
        query:
          resolveQuery,

        requester,
      });
  } catch (error) {
    console.error(
      '[USAGI AUDIO] Lavalink resolve error:',
      error,
    );

    throw new TitanBotError(
      'YouTube resolve failed',
      ErrorTypes.CONFIGURATION,
      '🌸 Lavalink không thể tìm hoặc đọc audio YouTube này.',
    );
  }

  /**
   * =======================================================
   * LOAD TYPE
   * =======================================================
   */

  const loadType =
    String(
      result?.loadType ||
        '',
    ).toUpperCase();

  /**
   * =======================================================
   * DEBUG
   * =======================================================
   *
   * Giữ log này để nếu Lavalink gặp vấn đề,
   * terminal sẽ cho biết nó trả về loại gì.
   */

  console.log(
    '[USAGI AUDIO] YouTube resolve:',
    {
      query: cleanQuery,
      directUrl,
      loadType,
      trackCount:
        Array.isArray(
          result?.tracks,
        )
          ? result.tracks.length
          : 0,
    },
  );

  /**
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

  /**
   * =======================================================
   * GET TRACKS
   * =======================================================
   */

  let tracks =
    Array.isArray(
      result?.tracks,
    )
      ? result.tracks.filter(Boolean)
      : [];

  /**
   * =======================================================
   * NO TRACKS
   * =======================================================
   */

  if (!tracks.length) {
    return [];
  }

  /**
   * =======================================================
   * DIRECT YOUTUBE URL
   * =======================================================
   *
   * QUAN TRỌNG:
   *
   * Không kiểm tra:
   *
   *     track.info.uri
   *
   * bằng regex YouTube nữa.
   *
   * Vì Lavalink đã resolve trực tiếp URL mà người dùng
   * cung cấp.
   *
   * Chỉ lấy track đầu tiên.
   *
   * Không lấy playlist.
   */

  if (directUrl) {
    tracks = [
      tracks[0],
    ];
  }

  /**
   * =======================================================
   * SEARCH RESULTS
   * =======================================================
   *
   * Query đã được gửi bằng:
   *
   *     ytsearch:<query>
   *
   * nên không cần tiếp tục lọc info.uri.
   *
   * Lavalink chính là nơi xác định source.
   *
   * Giữ tối đa 10 kết quả.
   */

  if (!directUrl) {
    tracks =
      tracks.slice(
        0,
        MAX_RESULTS,
      );
  }

  /**
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

      /**
       * Giữ nguyên track gốc.
       *
       * Riffy cần object này để:
       *
       *     player.queue.add(track)
       */

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

/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default {
  searchYouTubeAudio,
  isYouTubeUrl,
  formatAudioDuration,
};
