import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';

import { AUDIO_DEFAULTS } from '../../../config/audio/audioDefaults.js';

export default {
  name: 'audio:search',

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('audio:search-modal')
      .setTitle('🔎 Tìm Audio');

    const searchInput = new TextInputBuilder()
      .setCustomId('query')
      .setLabel('Bạn muốn nghe gì?')
      .setPlaceholder(
        AUDIO_DEFAULTS.searchDashboard.placeholder,
      )
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200);

    modal.addComponents(
      new ActionRowBuilder().addComponents(searchInput),
    );

    await interaction.showModal(modal);
  },
};
