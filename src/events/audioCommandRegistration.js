import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    const guildId = process.env.GUILD_ID;
    const clientId = process.env.CLIENT_ID;

    if (!guildId) {
      logger.warn(
        '[Audio] GUILD_ID is not configured. Skipping /audio registration.',
      );
      return;
    }

    if (!clientId) {
      logger.warn(
        '[Audio] CLIENT_ID is not configured. Skipping /audio registration.',
      );
      return;
    }

    const audioCommand = client.commands?.get('audio');

    if (!audioCommand?.data) {
      logger.warn(
        '[Audio] /audio was not found in client.commands.',
      );
      return;
    }

    try {
      await client.rest.put(
        `/applications/${clientId}/guilds/${guildId}/commands`,
        {
          body: [audioCommand.data.toJSON()],
        },
      );

      logger.info(
        `[Audio] /audio registered successfully for guild ${guildId}.`,
      );
    } catch (error) {
      logger.error(
        '[Audio] Failed to register /audio:',
        error,
      );
    }
  },
};
