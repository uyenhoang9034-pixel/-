/**
 * Usagi Audio Manager
 *
 * Central controller for the new Audio system.
 *
 * IMPORTANT:
 * This module does NOT modify or depend on the existing music manager.
 */

import { AUDIO_DEFAULTS } from '../../config/audio/audioDefaults.js';

class AudioManager {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Get an existing guild audio session.
   */
  getSession(guildId) {
    return this.sessions.get(guildId) ?? null;
  }

  /**
   * Create a new guild audio session.
   */
  createSession(guildId) {
    const existing = this.getSession(guildId);

    if (existing) {
      return existing;
    }

    const session = {
      guildId,

      enabled: AUDIO_DEFAULTS.enabled,

      audioChannelId: AUDIO_DEFAULTS.audioChannelId,

      voiceChannelId: null,

      textChannelId: null,

      dashboardMessageId: null,

      playerMessageId: null,

      currentTrack: null,

      queue: [],

      history: [],

      loopMode: AUDIO_DEFAULTS.queue.loopMode,

      volume: 100,

      isPlaying: false,

      isPaused: false,

      createdAt: Date.now(),
    };

    this.sessions.set(guildId, session);

    return session;
  }

  /**
   * Get or create a session.
   */
  getOrCreateSession(guildId) {
    return this.getSession(guildId) ?? this.createSession(guildId);
  }

  /**
   * Remove a guild session.
   */
  deleteSession(guildId) {
    this.sessions.delete(guildId);
  }

  /**
   * Check whether /audio can be used in the supplied channel.
   */
  isAllowedChannel(guildId, channelId) {
    const session = this.getOrCreateSession(guildId);

    /*
     * During initial setup, no channel has been configured yet.
     *
     * We allow the command temporarily so the dashboard can be created.
     * Once audioChannelId exists, /audio becomes restricted to that channel.
     */
    if (!session.audioChannelId) {
      return true;
    }

    return session.audioChannelId === channelId;
  }

  /**
   * Set the fixed Audio channel.
   */
  setAudioChannel(guildId, channelId) {
    const session = this.getOrCreateSession(guildId);

    session.audioChannelId = channelId;

    return session;
  }

  /**
   * Get the search dashboard configuration.
   */
  getSearchDashboard() {
    return {
      ...AUDIO_DEFAULTS.searchDashboard,
    };
  }

  /**
   * Get the player dashboard configuration.
   */
  getPlayerDashboard() {
    return {
      ...AUDIO_DEFAULTS.playerDashboard,
    };
  }

  /**
   * Get a safe snapshot of a guild session.
   *
   * This prevents external code from accidentally modifying
   * the internal session object.
   */
  getSessionSnapshot(guildId) {
    const session = this.getSession(guildId);

    if (!session) {
      return null;
    }

    return {
      ...session,
      queue: [...session.queue],
      history: [...session.history],
    };
  }

  /**
   * Get all active sessions.
   */
  getAllSessions() {
    return [...this.sessions.values()];
  }
}

const audioManager = new AudioManager();

export default audioManager;
