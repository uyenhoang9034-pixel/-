/**
 * Usagi Audio - YouTube Search
 *
 * Audio chỉ tìm trên YouTube.
 * Playback dùng chung Riffy/Lavalink hiện tại.
 */

import {
  TitanBotError,
  ErrorTypes,
} from '../../utils/errorHandler.js';

const MAX_RESULTS = 10;
const MAX_QUERY_LENGTH = 200;

function assertRiffy(client) {
  if (!client?.riffy) {
    throw new TitanBotError(
      'Audio Lavalink unavailable',
      ErrorTypes.CONFIGURATION,
      '🌸 Hệ thống Audio hiện không kết nối được với Lavalink.',
    );
  }
}

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

  /*
   * QUAN TRỌNG
   *
   * Dùng ytsearch:
   *
   * - Chỉ tìm YouTube
   * - Không tìm Spotify
   * - Không tìm SoundCloud
   * - Không dùng ytmsearch
   *
   * ytmsearch dùng MUSIC client,
   * trong khi MUSIC không phải playback client.
   */
  const result =
    await client.riffy.resolve({
      query:
        `ytsearch:${cleanQuery}`,

      requester: null,
    });

  const loadType =
    String(
      result?.loadType || '',
    ).toUpperCase();

  if (
    loadType === 'NO_MATCHES' ||
    loadType === 'NO_MATCH' ||
    loadType === 'EMPTY'
  ) {
    return [];
  }

  const tracks =
    Array.isArray(
      result?.tracks,
    )
      ? result.tracks
      : [];

  return tracks
    .filter((track) => {
      const uri =
        track?.info?.uri || '';

      return /(?:youtube\.com|youtu\.be)/i.test(
        uri,
      );
    })
    .slice(0, MAX_RESULTS)
    .map(
      (track, index) => ({
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

  if (hours > 0) {
    return (
      `${hours}:` +
      `${String(minutes).padStart(2, '0')}:` +
      `${String(seconds).padStart(2, '0')}`
    );
  }

  return (
    `${minutes}:` +
    `${String(seconds).padStart(2, '0')}`
  );
}
