import { Events } from 'discord.js';

import { logger } from '../utils/logger.js';

import {
  getAutoresponderConfig,
  findMatchingResponder,
} from '../services/autoresponder/autoresponderService.js';

import {
  buildDiscordMessagePayload,
} from '../services/autoresponder/responseBuilder.js';

const TIEN_TON_USAGI_ID =
  '1547576743521550346';

const CULTIVATION_CHANNEL_ID =
  '1547233544412205066';

const CULTIVATION_RULES_KEYWORD =
  '&gttutien';

function isValidCultivationTrigger(message) {
  const content =
    message.content
      ?.trim()
      ?.toLowerCase();

  return Boolean(
    message.guild &&
    message.author?.id === TIEN_TON_USAGI_ID &&
    message.author?.bot === true &&
    content === CULTIVATION_RULES_KEYWORD &&
    message.channel?.isThread?.() &&
    message.channel.parentId === CULTIVATION_CHANNEL_ID
  );
}

export default {
  name:
    Events.MessageCreate,

  async execute(
    message,
    client,
  ) {
    try {
      if (
        !isValidCultivationTrigger(
          message,
        )
      ) {
        return;
      }

      const config =
        await getAutoresponderConfig(
          client,
          message.guild.id,
        );

      const responder =
        findMatchingResponder(
          CULTIVATION_RULES_KEYWORD,
          config.responders,
        );

      if (!responder) {
        logger.warn(
          `[TU TIEN AUTORESPONDER] Không tìm thấy responder cho keyword ${CULTIVATION_RULES_KEYWORD}.`,
        );
        return;
      }

      const payload =
        buildDiscordMessagePayload(
          responder.response,
        );

      if (
        responder.response
          ?.reply
          ?.enabled
      ) {
        payload.reply = {
          messageReference:
            message.id,
          failIfNotExists:
            false,
          allowedMentions: {
            repliedUser:
              false,
          },
        };
      }

      await message.channel.send(
        payload,
      );

      logger.info(
        '[TU TIEN AUTORESPONDER] Đã gửi nội quy Tiên Lộ.',
        {
          guildId:
            message.guild.id,
          threadId:
            message.channel.id,
          responderId:
            responder.id,
        },
      );
    } catch (error) {
      logger.error(
        '[TU TIEN AUTORESPONDER] Bridge error:',
        error,
      );
    }
  },
};
