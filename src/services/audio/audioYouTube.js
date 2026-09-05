/**
 * =========================================================
 * USAGI AUDIO — YOUTUBE
 * =========================================================
 *
 * Chỉ sử dụng YouTube.
 *
 * Hỗ trợ:
 *
 * /audio
 * → tìm kiếm bằng từ khóa
 *
 * /audio input:<youtube url>
 * → phát trực tiếp video YouTube
 *
 * Không sử dụng:
 * - Spotify
 * - SoundCloud
 * - Apple Music
 * - YouTube Music search
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
 * https://www.youtube.com/live/...
 */
const YOUTUBE_URL_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)(?:\/|$)/i;

function assertRiffy(client) {
  if (!client?.riffy) {
    throw new TitanBotError(
      'Audio Lavalink unavailable',
      ErrorTypes.CONFIGURATION,
      '🌸 Hệ thống Audio hiện không kết nối được với Lavalink.',
    );
  }
}

/**
 * =========================================================
 * CHECK YOUTUBE URL
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
 * SEARCH / RESOLVE YOUTUBE AUDIO
 * =========================================================
 */

export async function searchYouTubeAudio(
  client,
  query,
) {
  assertRiffy(client);

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
   * DIRECT YOUTUBE LINK
   * =======================================================
   *
   * Quan trọng:
   *
   * Không thêm ytsearch:
   *
   *     ytsearch:https://youtube...
   *
   * Vì như vậy Lavalink sẽ coi URL là từ khóa tìm kiếm.
   *
   * URL được resolve trực tiếp.
   */

  const resolveQuery =
    directUrl
      ? cleanQuery
      : `ytsearch:${cleanQuery}`;

  const result =
    await client.riffy.resolve({
      query:
        resolveQuery,

      requester:
        null,
    });

  const loadType =
    String(
      result?.loadType ||
        '',
    ).toUpperCase();

  /*
   * =======================================================
   * NO RESULT
   * =======================================================
   */

  if (
    loadType ===
      'NO_MATCHES' ||
    loadType ===
      'NO_MATCH' ||
    loadType ===
      'EMPTY'
  ) {
    return [];
  }

  let tracks =
    Array.isArray(
      result?.tracks,
    )
      ? result.tracks
      : [];

  /*
   * =======================================================
   * DIRECT URL
   * =======================================================
   *
   * Link YouTube chỉ lấy video đầu tiên.
   *
   * Không tự phát cả playlist.
   */

  if (directUrl) {
    const youtubeTracks =
      tracks.filter(
        (track) => {
          const uri =
            track?.info?.uri ||
            '';

          return /(?:youtube\.com|youtu\.be)/i.test(
            uri,
          );
        },
      );

    if (
      !youtubeTracks.length
    ) {
      return [];
    }

    tracks =
      youtubeTracks.slice(
        0,
        1,
      );
  } else {
    /*
     * =====================================================
     * NORMAL SEARCH
     * =====================================================
     *
     * Chỉ trả kết quả YouTube.
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
   * NORMALIZE RESULTS
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
