/**
 * Usagi Audio Dashboard
 *
 * UI builder only.
 * No playback logic lives here.
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
 * Build the main Audio search buttons.
 */
export function buildAudioSearchButtons() {
  const config = AUDIO_DEFAULTS.searchDashboard;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('audio:search')
      .setLabel(config.searchButtonLabel)
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('audio:queue')
      .setLabel('Queue')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('audio:favorites')
      .setLabel('Favorites')
      .setEmoji('♡')
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Build the complete search dashboard.
 */
export function buildAudioSearchDashboard() {
  return {
    embeds: [buildAudioSearchEmbed()],
    components: [buildAudioSearchButtons()],
  };
}

/**
 * Build the "not found" message.
 */
export function buildAudioNoResultsEmbed(query) {
  return new EmbedBuilder()
    .setTitle('🌸 Không tìm thấy audio')
    .setDescription(
      [
        `Usagi không tìm thấy kết quả phù hợp với:`,
        '',
        `> **${query}**`,
        '',
        'Thử một từ khóa khác nhé ♡',
      ].join('\n'),
    )
    .setColor(AUDIO_DEFAULTS.searchDashboard.color);
}
