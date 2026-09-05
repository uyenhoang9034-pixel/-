import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    const guildId =
      client.config?.bot?.guildId ||
      process.env.GUILD_ID;

    const clientId =
      client.config?.bot?.clientId ||
      process.env.CLIENT_ID;

    if (!guildId) {
      logger.warn(
        '[Audio] GUILD_ID is not configured. Skipping guild registration.',
      );
      return;
    }

    if (!clientId) {
      logger.warn(
        '[Audio] CLIENT_ID is not configured. Skipping guild registration.',
      );
      return;
    }

    const audioCommand = client.commands?.get('audio');

    if (!audioCommand?.data) {
      logger.warn(
        '[Audio] /audio command was not found in client.commands.',
      );
      return;
    }

    try {
      const commandData = audioCommand.data.toJSON();

      await client.rest.put(
        `/applications/${clientId}/guilds/${guildId}/commands`,
        {
          body: [commandData],
        },
      );

      logger.info(
        `[Audio] Successfully registered /audio to guild ${guildId}.`,
      );
    } catch (error) {
      logger.error(
        '[Audio] Failed to register /audio command:',
        error,
      );
    }
  },
};
