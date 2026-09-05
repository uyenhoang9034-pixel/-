import {
  EmbedBuilder,
} from 'discord.js';

import audioManager from '../../../services/audio/audioManager.js';

export default {
  name: 'audio:search-modal',

  async execute(interaction) {
    const query = interaction.fields
      .getTextInputValue('query')
      .trim();

    if (!query) {
      return interaction.reply({
        content: '🌸 Bạn chưa nhập nội dung cần tìm.',
        ephemeral: true,
      });
    }

    const session = audioManager.getOrCreateSession(
      interaction.guildId,
    );

    session.lastSearchQuery = query;

    const searchingEmbed = new EmbedBuilder()
      .setTitle('🔎 Usagi đang tìm kiếm...')
      .setDescription(
        [
          'Usagi đang tìm nội dung trên YouTube ♡',
          '',
          `> **${query}**`,
          '',
          '⏳ Một chút xíu thôi nhé...',
        ].join('\n'),
      )
      .setColor(0xffb6d9);

    await interaction.reply({
      embeds: [searchingEmbed],
    });
  },
};
