/**
 * Usagi Audio Dashboard
 *
 * UI builder only.
 * Playback logic will be added in later phases.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

import { AUDIO_DEFAULTS } from '../../config/audio/audioDefaults.js';

/**
 * Build the main Audio search embed.
 */
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

/**
 * Build the main Audio search button.
 */
export function buildAudioSearchButtons() {
  const config = AUDIO_DEFAULTS.searchDashboard;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('audio:search')
      .setLabel(config.searchButtonLabel)
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary),
  );
}

/**
 * Build the complete Audio search dashboard.
 */
export function buildAudioSearchDashboard() {
  return {
    embeds: [buildAudioSearchEmbed()],
    components: [buildAudioSearchButtons()],
  };
}

/**
 * Build the "no results" embed.
 *
 * This will be used when YouTube integration is added.
 */
export function buildAudioNoResultsEmbed(query) {
  return new EmbedBuilder()
    .setTitle('🌸 Không tìm thấy audio')
    .setDescription(
      [
        'Usagi không tìm thấy kết quả phù hợp với:',
        '',
        `> **${query}**`,
        '',
        'Thử một từ khóa khác nhé ♡',
      ].join('\n'),
    )
    .setColor(AUDIO_DEFAULTS.searchDashboard.color);
}
