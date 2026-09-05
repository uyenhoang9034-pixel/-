import {
  EmbedBuilder,
} from 'discord.js';

import audioManager from '../../../services/audio/audioManager.js';

export async function handleAudioSearchModal(interaction) {
  if (interaction.customId !== 'audio:search-modal') {
    return false;
  }

  const query = interaction.fields
    .getTextInputValue('query')
    .trim();

  if (!query) {
    await interaction.reply({
      content: '🌸 Bạn chưa nhập nội dung cần tìm.',
      ephemeral: true,
    });

    return true;
  }

  if (query.length > 200) {
    await interaction.reply({
      content: '🌸 Nội dung tìm kiếm quá dài.',
      ephemeral: true,
    });

    return true;
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

  /*
   * YouTube search will be connected in Phase 3.
   *
   * We deliberately stop here instead of pretending that
   * a search result exists.
   */
  return true;
}

export default handleAudioSearchModal;
