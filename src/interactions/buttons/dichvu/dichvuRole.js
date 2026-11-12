import { MessageFlags } from 'discord.js';
import { toggleDichVuCustomerRole } from '../../../services/dichVuService.js';

export default {
  name: 'dichvu_role',

  async execute(interaction, client, args = []) {
    if (!interaction.inGuild()) {
      return;
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});

    const [action] = args;
    const result = await toggleDichVuCustomerRole(interaction, action);

    return interaction.editReply({
      content: result.message,
      allowedMentions: { parse: [] },
    });
  },
};

