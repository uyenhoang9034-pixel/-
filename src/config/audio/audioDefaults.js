/**
 * Usagi Audio
 * Default configuration
 *
 * This module is intentionally isolated from the existing music system.
 */

export const AUDIO_DEFAULTS = {
  enabled: true,

  // The bot will only allow /audio inside this channel.
  // Set this later through the Audio Dashboard.
  audioChannelId: '1545469460931154052',

  // Search dashboard
  searchDashboard: {
    title: '🌸 Usagi Audio',
    description:
      'Tìm một câu chuyện, podcast hoặc audio mà bạn muốn nghe cùng Usagi nhé ♡',

    image: null,

    color: 0xffb6d9,

    placeholder: '🔎 Bạn muốn nghe gì hôm nay?',

    searchButtonLabel: '🔍 Search Audio',
  },

  // Player dashboard
  playerDashboard: {
    title: '🎧 Now Listening',
    description: 'Usagi đang cùng bạn lắng nghe ♡',

    image: null,

    color: 0xffb6d9,

    showProgress: true,
    showVolume: true,
    showQueue: true,
  },

  // Search behaviour
  search: {
    maxResults: 10,

    regionCode: 'VN',

    relevanceLanguage: 'vi',

    safeSearch: 'moderate',
  },

  // Queue behaviour
  queue: {
    maxTracks: 20,

    loopMode: 'none',
  },

  // Permissions
  permissions: {
    controlMode: 'voice',
  },

  // Automatic disconnect
  autoDisconnect: {
    enabled: true,

    delayMs: 60_000,
  },
};

export default AUDIO_DEFAULTS;
