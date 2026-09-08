import { Events } from 'discord.js';

import { logger } from '../utils/logger.js';

import {
  getLevelingConfig,
  getUserLevelData,
} from '../services/leveling/leveling.js';

import { addXp } from '../services/leveling/xpSystem.js';

import { checkRateLimit } from '../utils/rateLimiter.js';

import {
  parsePrefixCommand,
} from '../utils/prefixParser.js';

import {
  supportsPrefixExecution,
  executePrefixCommand,
  resolvePrefixAccessKey,
} from '../utils/messageAdapter.js';

import {
  resolveCommandAlias,
  resolveSubcommandAlias,
} from '../config/commands/commandAliases.js';

import {
  getPrefixRestriction,
} from '../config/commands/prefixRestrictions.js';

import {
  getGuildConfig,
} from '../services/config/guildConfig.js';

import {
  getCommandPrefix,
  getBotMessage,
  isBotOwner,
  isCommandCategoryEnabled,
  isMaintenanceMode,
} from '../config/bot.js';

import {
  enforceAbuseProtection,
  formatCooldownDuration,
} from '../utils/abuseProtection.js';

import {
  createEmbed,
} from '../utils/embeds.js';

import {
  isCommandEnabled,
} from '../services/commandAccessService.js';

import {
  getCountingGameConfig,
  saveCountingGameConfig,
  isValidCountingMessage,
  recordCorrectCount,
} from '../services/countingGameService.js';

import {
  getAutoresponderConfig,
  findMatchingResponder,
  canTriggerResponder,
} from '../services/autoresponder/autoresponderService.js';

import {
  buildDiscordMessagePayload,
} from '../services/autoresponder/responseBuilder.js';

import {
  WORD_CHAIN_CHANNELS,
  getWordChainModeForChannel,
  getWordChainGame,
  getWordChainConfig,
  isValidWord,
  canChain,
  normalizeWord,
  getLastSyllable,
  findBotNextWord,
  getRandomStartWord,
  recordUserSuccess,
  recordUserFailure,
  recordBotSuccess,
  recordBreak,
} from '../services/wordChainService.js';
import {
  getAutoReactConfig,
  findMatchingAutoReacts,
} from '../services/autoreact/autoreactService.js';

const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;

/**
 * =========================================================
 * WORD CHAIN EMOJIS
 * =========================================================
 */

const WORD_CHAIN_EMOJIS = {
  streak:
    '<a:trangtrig29:1546385117478527016>',

  correct:
    '✅',

  wrong:
    '❌',

  end:
    '<a:animeg2:1546040159886114846>',

  newRound:
    '<a:animeg3:1546040346717331477>',

  botSuccess:
    '<a:trangtrig19:1546068350030053406>',

  wrongWord:
    '<a:capybarag1:1546058369566122015>',

  wrongChain:
    '<a:meongg14:1546092766826864661>',
};

/**
 * =========================================================
 * EVENT
 * =========================================================
 */

export default {
  name: Events.MessageCreate,

  async execute(
    message,
    client,
  ) {
    try {
      if (
        message.author.bot ||
        !message.guild
      ) {
        return;
      }
      await handleAutoReact(
  message,
  client,
);

      logger.debug(
        `Message received from ${message.author.tag}: ${message.content}`,
      );

      const countingProcessed =
        await handleCountingGame(
          message,
          client,
        );

      let wordChainProcessed =
        false;

      if (
        !countingProcessed
      ) {
        wordChainProcessed =
          await handleWordChain(
            message,
            client,
          );
      }

      if (
        !countingProcessed &&
        !wordChainProcessed
      ) {
        const autoresponderProcessed =
          await handleAutoresponder(
            message,
            client,
          );

        if (
          !autoresponderProcessed
        ) {
          await handlePrefixCommand(
            message,
            client,
          );
        }

        await handleLeveling(
          message,
          client,
        );
      }
    } catch (error) {
      logger.error(
        'Error in messageCreate event:',
        error,
      );
    }
  },
};

/**
 * =========================================================
 * PREFIX COMMAND
 * =========================================================
 */

async function handlePrefixCommand(
  message,
  client,
) {
  try {
    const guildConfig =
      await getGuildConfig(
        client,
        message.guild.id,
      );

    const prefix =
      guildConfig?.prefix ||
      getCommandPrefix();

    const parsed =
      parsePrefixCommand(
        message.content,
        prefix,
      );

    if (!parsed) {
      return;
    }

    let {
      commandName,
      args,
    } = parsed;

    const musicPrefixShortcut =
      commandName.toLowerCase();

    const MUSIC_PREFIX_SHORTCUTS =
      new Set([
        'leave',
        'pause',
        'resume',
        'skip',
        'stop',
        'volume',
      ]);

    if (
      MUSIC_PREFIX_SHORTCUTS.has(
        musicPrefixShortcut,
      )
    ) {
      commandName = 'music';

      args = [
        musicPrefixShortcut,
        ...args,
      ];
    }

    logger.info(
      `Prefix command detected: ${commandName}, args: ${args.join(', ')}`,
    );

    const resolvedCommandName =
      resolveCommandAlias(
        commandName,
      );

    const command =
      client.commands.get(
        resolvedCommandName,
      );

    if (!command) {
      logger.warn(
        `Command not found: ${resolvedCommandName}`,
      );

      return;
    }

    if (
      isMaintenanceMode() &&
      !isBotOwner(
        message.author.id,
      )
    ) {
      await message.channel
        .send({
          embeds: [
            createEmbed({
              title:
                'Maintenance Mode',

              description:
                getBotMessage(
                  'maintenanceMode',
                ),

              color:
                'warning',
            }),
          ],
        })
        .catch(() => {});

      return;
    }

    if (
      !isCommandCategoryEnabled(
        command.category,
      )
    ) {
      await message.channel
        .send({
          embeds: [
            createEmbed({
              title:
                'Feature Disabled',

              description:
                getBotMessage(
                  'commandDisabled',
                ),

              color:
                'error',
            }),
          ],
        })
        .catch(() => {});

      return;
    }

    const restriction =
      getPrefixRestriction(
        command,
        args,
        resolveSubcommandAlias,
      );

    if (
      !supportsPrefixExecution(
        command,
      ) ||
      restriction.blocked
    ) {
      if (
        restriction.blocked &&
        restriction.reason
      ) {
        await message.channel
          .send({
            embeds: [
              createEmbed({
                title:
                  'Slash Command Only',

                description:
                  `${restriction.reason}\nUse \`/${resolvedCommandName}\` instead.`,

                color:
                  'info',
              }),
            ],
          })
          .catch(() => {});
      }

      return;
    }

    if (
      !(await isCommandEnabled(
        client,
        message.guild.id,
        resolvePrefixAccessKey(
          command.data,
          args,
        ),
        command.category,
      ))
    ) {
      await message.channel
        .send({
          embeds: [
            createEmbed({
              title:
                'Command Disabled',

              description:
                'This command has been disabled for this server.',

              color:
                'error',
            }),
          ],
        })
        .catch(() => {});

      return;
    }

    const mockInteractionForProtection =
      {
        guildId:
          message.guild.id,

        user:
          message.author,
      };

    const abuseProtection =
      await enforceAbuseProtection(
        mockInteractionForProtection,
        command,
        resolvedCommandName,
      );

    if (
      !abuseProtection.allowed
    ) {
      const formattedCooldown =
        formatCooldownDuration(
          abuseProtection.remainingMs,
        );

      await message.channel
        .send({
          embeds: [
            createEmbed({
              title:
                'Command Cooldown',

              description:
                `This command is on cooldown. Please wait ${formattedCooldown} before trying again.`,

              color:
                'error',
            }),
          ],
        })
        .catch(() => {});

      return;
    }

    await executePrefixCommand(
      command,
      message,
      args,
      client,
      prefix,
      guildConfig,
    );
  } catch (error) {
    logger.error(
      'Error handling prefix command:',
      error,
    );
  }
}

/**
 * =========================================================
 * COUNTING GAME
 * =========================================================
 */

async function handleCountingGame(
  message,
  client,
) {
  try {
    const config =
      await getCountingGameConfig(
        client,
        message.guild.id,
      );

    if (
      !config.enabled ||
      !config.channelId ||
      message.channel.id !==
        config.channelId
    ) {
      return false;
    }

    const content =
      message.content.trim();

    const validCount =
      isValidCountingMessage(
        content,
        config,
      );

    const invalidAttempt =
      !validCount ||
      message.author.id ===
        config.lastUserId;

    if (
      invalidAttempt
    ) {
      await message.delete()
        .catch(() => {});

      await saveCountingGameConfig(
        client,
        message.guild.id,
        {
          ...config,
          nextNumber: 1,
          lastUserId: null,
          currentStreak: 0,
        },
      );

      const failureMessage =
        await message.channel.send(
          `❌ Count broken by <@${message.author.id}>. The sequence has been reset to **1**.`,
        );

      setTimeout(
        () => {
          failureMessage
            .delete()
            .catch(() => {});
        },
        10000,
      );

      return true;
    }

    await recordCorrectCount(
      client,
      message.guild.id,
      message.author.id,
    );

    return true;
  } catch (error) {
    logger.error(
      'Error handling counting game:',
      error,
    );

    return false;
  }
}

/**
 * =========================================================
 * WORD CHAIN
 * =========================================================
 *
 * QUAN TRỌNG:
 *
 * PvP và PvE chạy độc lập.
 *
 * PvP:
 * 1545291672504508416
 *
 * PvE:
 * 1546428675367505920
 */

async function handleWordChain(
  message,
  client,
) {
  try {
    /**
     * =====================================================
     * RESOLVE MODE THEO CHANNEL
     * =====================================================
     */

    const mode =
      getWordChainModeForChannel(
        message.channel.id,
      );

    if (!mode) {
      return false;
    }

    const config =
      await getWordChainConfig(
        client,
        message.guild.id,
      );

    const game =
      getWordChainGame(
        config,
        mode,
      );

    if (
      !config.enabled ||
      !game.enabled
    ) {
      return false;
    }

    const content =
      message.content.trim();

    if (!content) {
      return false;
    }

    /**
     * =====================================================
     * IGNORE COMMAND
     * =====================================================
     */

    if (
      content.startsWith('/') ||
      content.startsWith('!') ||
      content.startsWith('.')
    ) {
      return false;
    }

    /**
     * =====================================================
     * NORMALIZE
     * =====================================================
     */

    const normalized =
      normalizeWord(
        content,
      );

    if (!normalized) {
      return false;
    }

    /**
     * =====================================================
     * EXACTLY 2 SYLLABLES
     * =====================================================
     */

    const parts =
      normalized
        .split(/\s+/)
        .filter(Boolean);

    if (
      parts.length !== 2 ||
      !parts.every(
        (part) =>
          /^\p{L}+$/u.test(
            part,
          ),
      )
    ) {
      /**
       * Không đúng 2 tiếng:
       *
       * - không X
       * - không V
       * - không streak
       * - không leaderboard
       * - không thông báo
       */
      return false;
    }

    const needed =
      getLastSyllable(
        game.currentWord,
      );

    /**
     * =====================================================
     * PVP — SAME USER CANNOT PLAY TWICE
     * =====================================================
     */

    if (
      mode === 'pvp' &&
      game.lastUserId ===
        message.author.id
    ) {
      await recordUserFailure(
        client,
        message.guild.id,
        message.author.id,
        mode,
      );

      await message.react(
        WORD_CHAIN_EMOJIS.wrong,
      ).catch(() => {});

      const warnMsg =
        await message.reply(
          `Bạn đã sử dụng một từ không khớp với lượt chơi. Hãy để người chơi khác nối tiếp từ **${needed}**! ${WORD_CHAIN_EMOJIS.wrongChain}`,
        ).catch(() => null);

      if (warnMsg) {
        setTimeout(
          () =>
            warnMsg
              .delete()
              .catch(() => {}),
          6000,
        );
      }

      return true;
    }

    /**
     * =====================================================
     * WRONG CHAIN
     * =====================================================
     */

    if (
      game.currentWord &&
      !canChain(
        game.currentWord,
        normalized,
      )
    ) {
      await recordUserFailure(
        client,
        message.guild.id,
        message.author.id,
        mode,
      );

      await message.react(
        WORD_CHAIN_EMOJIS.wrong,
      ).catch(() => {});

      const warnMsg =
        await message.reply(
          `Bạn đã sử dụng một từ không khớp với từ trước đó. Bạn cần bắt đầu bằng **${needed}**! ${WORD_CHAIN_EMOJIS.wrongChain}`,
        ).catch(() => null);

      if (warnMsg) {
        setTimeout(
          () =>
            warnMsg
              .delete()
              .catch(() => {}),
          6000,
        );
      }

      return true;
    }

    /**
     * =====================================================
     * USED WORD
     * =====================================================
     */

    const usedWords =
      game.usedWords || [];

    if (
      usedWords.includes(
        normalized,
      )
    ) {
      await recordUserFailure(
        client,
        message.guild.id,
        message.author.id,
        mode,
      );

      await message.react(
        WORD_CHAIN_EMOJIS.wrong,
      ).catch(() => {});

      const warnMsg =
        await message.reply(
          `Bạn đã sử dụng từ này rồi. Hãy bắt đầu một từ mới với **${needed}**! ${WORD_CHAIN_EMOJIS.wrongWord}`,
        ).catch(() => null);

      if (warnMsg) {
        setTimeout(
          () =>
            warnMsg
              .delete()
              .catch(() => {}),
          6000,
        );
      }

      return true;
    }

    /**
     * =====================================================
     * DICTIONARY
     * =====================================================
     */

    if (
      !isValidWord(
        normalized,
      )
    ) {
      await recordUserFailure(
        client,
        message.guild.id,
        message.author.id,
        mode,
      );

      await message.react(
        WORD_CHAIN_EMOJIS.wrong,
      ).catch(() => {});

      const warnMsg =
        await message.reply(
          `Từ này không hợp lệ. Hãy bắt đầu một từ mới với **${needed}**! ${WORD_CHAIN_EMOJIS.wrongWord}`,
        ).catch(() => null);

      if (warnMsg) {
        setTimeout(
          () =>
            warnMsg
              .delete()
              .catch(() => {}),
          6000,
        );
      }

      return true;
    }

    /**
     * =====================================================
     * USER CORRECT
     * =====================================================
     */

 /**
 * =====================================================
 * USER CORRECT
 * =====================================================
 */

const afterUserSuccess =
  await recordUserSuccess(
    client,
    message.guild.id,
    message.author.id,
    normalized,
    mode,
  );

/**
 * Chỉ chấm ✅ khi lượt thực sự
 * được record thành công trong state.
 *
 * Nếu bị race với người chơi khác
 * thì recordUserSuccess() sẽ trả
 * __wordChainAccepted: false.
 */
if (
  !afterUserSuccess?.__wordChainAccepted
) {
  return true;
}

await message.react(
  WORD_CHAIN_EMOJIS.correct,
).catch(() => {});
    /**
     * =====================================================
     * PVP
     * =====================================================
     */

    if (
      mode === 'pvp'
    ) {
      const nextWord =
        findBotNextWord(
          normalized,
          [
            ...usedWords,
            normalized,
          ],
        );

      /**
       * Không còn bất kỳ từ nào
       * để người tiếp theo nối.
       *
       * -> kết thúc round ngay.
       */

      if (!nextWord) {
        const endedStreak =
          Number(
            afterUserSuccess
              .games
              ?.pvp
              ?.currentStreak ||
              0,
          );

        const finalWord =
          normalized;

        const nextStart =
          getRandomStartWord();

        await recordBreak(
          client,
          message.guild.id,
          nextStart,
          'pvp',
        );

        await message.channel
          .send(
            [
              `${WORD_CHAIN_EMOJIS.end} Quá siêu! Nối từ đã kết thúc sau chuỗi **${endedStreak}** với **${finalWord}** là từ cuối cùng.`,
              `${WORD_CHAIN_EMOJIS.newRound} Lượt PvP mới đã bắt đầu với từ **${nextStart}**!`,
            ].join('\n'),
          )
          .catch(() => {});
      }

      return true;
    }

    /**
     * =====================================================
     * PVE / BOT
     * =====================================================
     */

    const updatedUsedWords = [
      ...usedWords,
      normalized,
    ];

    const botWord =
      findBotNextWord(
        normalized,
        updatedUsedWords,
      );

    /**
     * =====================================================
     * BOT KHÔNG CÒN TỪ
     * =====================================================
     */

    if (!botWord) {
      const endedStreak =
        Number(
          afterUserSuccess
            .games
            ?.bot
            ?.personalStreaks
            ?.[
              message.author.id
            ] || 0,
        );

      const finalWord =
        normalized;

      const nextStart =
        getRandomStartWord();

      await recordBreak(
        client,
        message.guild.id,
        nextStart,
        'bot',
      );

      await message.channel
        .send(
          [
            `${WORD_CHAIN_EMOJIS.end} Quá siêu! Nối từ đã kết thúc sau chuỗi **${endedStreak}** với **${finalWord}** là từ cuối cùng.`,
            `${WORD_CHAIN_EMOJIS.newRound} Lượt PvE mới đã bắt đầu với từ **${nextStart}**!`,
          ].join('\n'),
        )
        .catch(() => {});

      return true;
    }

    /**
     * =====================================================
     * BOT RESPONSE
     * =====================================================
     */

    setTimeout(
      async () => {
        try {
          const latestConfig =
            await getWordChainConfig(
              client,
              message.guild.id,
            );

          const latestGame =
            getWordChainGame(
              latestConfig,
              'bot',
            );

          /**
           * Game đã thay đổi:
           *
           * - disable
           * - reset
           * - restart
           * - mode/setup
           * - currentWord thay đổi
           *
           * -> bỏ lượt bot cũ.
           */

          if (
            !latestConfig.enabled ||
            !latestGame.enabled ||
            latestGame.currentWord !==
              normalized
          ) {
            return;
          }

          if (
            !isValidWord(
              botWord,
            )
          ) {
            return;
          }

          const latestUsedWords =
            latestGame.usedWords ||
            [];

          if (
            latestUsedWords.includes(
              botWord,
            )
          ) {
            return;
          }

          await recordBotSuccess(
            client,
            message.guild.id,
            botWord,
            'bot',
          );

          const finalConfig =
            await getWordChainConfig(
              client,
              message.guild.id,
            );

          const finalGame =
            getWordChainGame(
              finalConfig,
              'bot',
            );

          const personalStreak =
            Number(
              finalGame
                .personalStreaks
                ?.[
                  message.author.id
                ] || 0,
            );

          /**
           * =================================================
           * BOT SEND WORD
           * =================================================
           */

          await message.channel
            .send(
              [
                `${WORD_CHAIN_EMOJIS.botSuccess} **${botWord}**`,
                `${WORD_CHAIN_EMOJIS.streak} <@${message.author.id}> — Chuỗi hiện tại: **${personalStreak}**!`,
                `${WORD_CHAIN_EMOJIS.newRound} Tiếng tiếp theo: **${getLastSyllable(botWord)}**`,
              ].join('\n'),
            )
            .catch(() => {});

          /**
           * =================================================
           * BOT WORD IS DEAD END
           * =================================================
           *
           * Sau khi bot vừa nối xong, kiểm tra xem
           * còn từ nào cho người chơi tiếp theo không.
           *
           * Nếu không:
           *
           * -> kết thúc round
           * -> reset
           * -> round mới.
           */

          const afterBotConfig =
            await getWordChainConfig(
              client,
              message.guild.id,
            );

          const afterBotGame =
            getWordChainGame(
              afterBotConfig,
              'bot',
            );

          const nextPossibleWord =
            findBotNextWord(
              afterBotGame.currentWord,
              afterBotGame.usedWords ||
                [],
            );

          if (
            !nextPossibleWord
          ) {
            const nextStart =
              getRandomStartWord();

            await recordBreak(
              client,
              message.guild.id,
              nextStart,
              'bot',
            );

            await message.channel
              .send(
                [
                  `${WORD_CHAIN_EMOJIS.end} Không còn từ phù hợp để nối tiếp **${botWord}**.`,
                  `${WORD_CHAIN_EMOJIS.newRound} Lượt PvE mới đã bắt đầu với từ **${nextStart}**!`,
                ].join('\n'),
              )
              .catch(() => {});
          }
        } catch (botErr) {
          logger.error(
            'Error sending bot response in word chain:',
            botErr,
          );
        }
      },
      1000,
    );

    return true;
  } catch (error) {
    logger.error(
      'Error handling word chain:',
      error,
    );

    return false;
  }
}

/**
 * =========================================================
 * LEVELING
 * =========================================================
 */

async function handleLeveling(
  message,
  client,
) {
  try {
    const rateLimitKey =
      `xp-event:${message.guild.id}:${message.author.id}`;

    const canProcess =
      await checkRateLimit(
        rateLimitKey,
        MESSAGE_XP_RATE_LIMIT_ATTEMPTS,
        MESSAGE_XP_RATE_LIMIT_WINDOW_MS,
      );

    if (!canProcess) {
      return;
    }

    const levelingConfig =
      await getLevelingConfig(
        client,
        message.guild.id,
      );

    if (
      !levelingConfig?.enabled
    ) {
      return;
    }

    if (
      levelingConfig
        .ignoredChannels
        ?.includes(
          message.channel.id,
        )
    ) {
      return;
    }

    if (
      levelingConfig
        .ignoredRoles
        ?.length > 0
    ) {
      const member =
        await message.guild.members
          .fetch(
            message.author.id,
          )
          .catch(
            () => null,
          );

      if (
        member &&
        member.roles.cache.some(
          (role) =>
            levelingConfig
              .ignoredRoles
              .includes(
                role.id,
              ),
        )
      ) {
        return;
      }
    }

    if (
      levelingConfig
        .blacklistedUsers
        ?.includes(
          message.author.id,
        )
    ) {
      return;
    }

    if (
      !message.content ||
      message.content.trim()
        .length === 0
    ) {
      return;
    }

    const userData =
      await getUserLevelData(
        client,
        message.guild.id,
        message.author.id,
      );

    const cooldownTime =
      levelingConfig.xpCooldown ||
      60;

    const now =
      Date.now();

    const timeSinceLastMessage =
      now -
      (
        userData.lastMessage ||
        0
      );

    if (
      timeSinceLastMessage <
      cooldownTime * 1000
    ) {
      return;
    }

    const minXP =
      levelingConfig
        .xpRange
        ?.min ||
      levelingConfig
        .xpPerMessage
        ?.min ||
      15;

    const maxXP =
      levelingConfig
        .xpRange
        ?.max ||
      levelingConfig
        .xpPerMessage
        ?.max ||
      25;

    const safeMinXP =
      Math.max(
        1,
        minXP,
      );

    const safeMaxXP =
      Math.max(
        safeMinXP,
        maxXP,
      );

    const xpToGive =
      Math.floor(
        Math.random() *
          (
            safeMaxXP -
            safeMinXP +
            1
          ),
      ) +
      safeMinXP;

    let finalXP =
      xpToGive;

    if (
      levelingConfig
        .xpMultiplier &&
      levelingConfig
        .xpMultiplier > 1
    ) {
      finalXP =
        Math.floor(
          finalXP *
            levelingConfig
              .xpMultiplier,
        );
    }

    const result =
      await addXp(
        client,
        message.guild,
        message.member,
        finalXP,
      );

    if (
      result?.leveledUp
    ) {
      logger.info(
        `${message.author.tag} leveled up to level ${result.level} in ${message.guild.name}`,
      );
    }
  } catch (error) {
    logger.error(
      'Error handling leveling for message:',
      error,
    );
  }
}

/**
 * =========================================================
 * AUTORESPONDER
 * =========================================================
 */

async function handleAutoresponder(
  message,
  client,
) {
  try {
    if (
      !message.guild ||
      !message.content?.trim()
    ) {
      return false;
    }

    const config =
      await getAutoresponderConfig(
        client,
        message.guild.id,
      );

    const responder =
      findMatchingResponder(
        message.content,
        config.responders,
      );

    if (!responder) {
      return false;
    }

    if (
      !canTriggerResponder(
        message.member,
        responder,
        config,
      )
    ) {
      return false;
    }

    const payload =
      buildDiscordMessagePayload(
        responder.response,
      );

    if (
      responder.response
        ?.reply?.enabled
    ) {
      payload.reply = {
        messageReference:
          message.id,

        failIfNotExists:
          false,

        allowedMentions: {
          repliedUser:
            responder.response
              ?.reply
              ?.mentionAuthor ===
            true,
        },
      };
    }

    await message.channel.send(
      payload,
    );

    logger.info(
      'Autoresponder triggered',
      {
        guildId:
          message.guild.id,

        channelId:
          message.channel.id,

        userId:
          message.author.id,

        responderId:
          responder.id,

        keyword:
          responder.displayKeyword ||
          responder.keyword,
      },
    );

    return true;
  } catch (error) {
    logger.error(
      'Error handling autoresponder:',
      error,
    );

    return false;
  }
}
/**
 * =========================================================
 * AUTO REACT
 * =========================================================
 */

async function handleAutoReact(
  message,
  client,
) {
  try {
    if (
      !message.guild ||
      !message.content?.trim()
    ) {
      return;
    }

    const config =
      await getAutoReactConfig(
        client,
        message.guild.id,
      );

    if (
      !config.enabled ||
      !config.reactions?.length
    ) {
      return;
    }

    const matches =
      findMatchingAutoReacts(
        message.content,
        config.reactions,
      );

    if (
      matches.length === 0
    ) {
      return;
    }

    /**
     * Mỗi keyword có thể có một emoji.
     *
     * Nếu một message match nhiều keyword,
     * bot sẽ react lần lượt với các emoji tương ứng.
     */
    const reactedEmojiIds =
      new Set();

    for (
      const reaction of matches
    ) {
      if (
        reactedEmojiIds.has(
          reaction.emojiId,
        )
      ) {
        continue;
      }

      /**
       * Chỉ cho phép emoji còn tồn tại
       * trong server hiện tại.
       */
      const emoji =
        message.guild.emojis.cache.get(
          reaction.emojiId,
        );

      if (!emoji) {
        continue;
      }

      await message
        .react(emoji)
        .catch(error => {
          logger.warn(
            `Failed to auto-react with ${emoji.name || reaction.emojiId}:`,
            error,
          );
        });

      reactedEmojiIds.add(
        reaction.emojiId,
      );
    }
  } catch (error) {
    logger.error(
      'Error handling auto-react:',
      error,
    );
  }
}
