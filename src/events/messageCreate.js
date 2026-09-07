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

const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;

/**
 * =========================================================
 * WORD CHAIN EMOJIS
 * =========================================================
 */

const WORD_CHAIN_EMOJIS = {
  streak:
    '<a:trangtrig19:1546068350030053406>',

  correct:
    '✅',

  wrong:
    '❌',

  end:
    '<a:animeg2:1546040159886114846>',

  newRound:
    '<a:animeg3:1546040346717331477>',

  botSuccess:
    '<a:trangtrig29:1546385117478527016>',

  wrongWord:
    '<a:capybarag1:1546058369566122015>',

  wrongChain:
    '<a:meongg14:1546092766826864661>',
};

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

      if (!countingProcessed) {
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

        if (!autoresponderProcessed) {
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

    logger.info(
      `Resolved command name: ${resolvedCommandName}`,
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
        const embed =
          createEmbed({
            title:
              'Slash Command Only',

            description:
              `${restriction.reason}\nUse \`/${resolvedCommandName}\` instead.`,

            color:
              'info',
          });

        await message.channel
          .send({
            embeds: [embed],
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
      const embed =
        createEmbed({
          title:
            'Command Disabled',

          description:
            'This command has been disabled for this server.',

          color:
            'error',
        });

      await message.channel
        .send({
          embeds: [embed],
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

      const embed =
        createEmbed({
          title:
            'Command Cooldown',

          description:
            `This command is on cooldown. Please wait ${formattedCooldown} before trying again.`,

          color:
            'error',
        });

      await message.channel
        .send({
          embeds: [embed],
        })
        .catch(() => {});

      return;
    }

    logger.info(
      `Executing prefix command: ${prefix}${commandName} (resolved to ${resolvedCommandName}) by ${message.author.tag}`,
    );

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

    if (invalidAttempt) {
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

      setTimeout(() => {
        failureMessage
          .delete()
          .catch(() => {});
      }, 10000);

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
 */

async function handleWordChain(
  message,
  client,
) {
  try {
    const config =
      await getWordChainConfig(
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

    if (!content) {
      return false;
    }

    /**
     * =====================================================
     * IGNORE COMMANDS
     * =====================================================
     *
     * Các command không phải lượt nối từ.
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
      normalizeWord(content);

    /**
     * =====================================================
     * FORMAT CHECK
     * =====================================================
     *
     * CHỈ ĐÚNG 2 TIẾNG MỚI ĐƯỢC XỬ LÝ
     *
     * Đây phải là bước kiểm tra TRƯỚC:
     *
     * - PvP lastUserId
     * - canChain()
     * - usedWords
     * - isValidWord()
     * - recordUserFailure()
     * - recordUserSuccess()
     * - streak
     * - leaderboard
     *
     * Ví dụ:
     *
     * "bạn"              → IGNORE
     * "bạn bè nhé"       → IGNORE
     * "😂"               → IGNORE
     * "😂😂"             → IGNORE
     * "bạn 😂"           → IGNORE
     * "bạn bè"           → XỬ LÝ
     *
     * Không đúng 2 tiếng:
     *
     * ❌ Không X
     * ❌ Không V
     * ❌ Không streak
     * ❌ Không leaderboard
     * ❌ Không thông báo lỗi
     */

    const parts =
      normalized
        .split(/\s+/)
        .filter(Boolean);

    if (
      parts.length !== 2 ||
      !parts.every(
        (part) =>
          /^\p{L}+$/u.test(part),
      )
    ) {
      return false;
    }

    /**
     * Từ hiện tại cần nối tiếp.
     */

    const needed =
      getLastSyllable(
        config.currentWord,
      );

    /**
     * =====================================================
     * PVP — KHÔNG ĐƯỢC TỰ NỐI 2 LƯỢT
     * =====================================================
     *
     * CHỈ chạy tới đây nếu message đã đúng 2 tiếng.
     */

    if (
      config.mode === 'pvp' &&
      config.lastUserId ===
        message.author.id
    ) {
      await recordUserFailure(
        client,
        message.guild.id,
        message.author.id,
      );

      await message.react(
        WORD_CHAIN_EMOJIS.wrong,
      ).catch(() => {});

      const warnMsg =
        await message.reply(
          `Bạn đã sử dụng một từ không khớp với từ trước đó. Bạn cần bắt đầu một từ mới với "${needed}" ! ${WORD_CHAIN_EMOJIS.wrongChain}`,
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
     * SAI TIẾNG NỐI
     * =====================================================
     */

    if (
      config.currentWord &&
      !canChain(
        config.currentWord,
        normalized,
      )
    ) {
      await recordUserFailure(
        client,
        message.guild.id,
        message.author.id,
      );

      await message.react(
        WORD_CHAIN_EMOJIS.wrong,
      ).catch(() => {});

      const warnMsg =
        await message.reply(
          `Bạn đã sử dụng một từ không khớp với từ trước đó. Bạn cần bắt đầu một từ mới với "${needed}" ! ${WORD_CHAIN_EMOJIS.wrongChain}`,
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
     * TRÙNG TỪ
     * =====================================================
     */

    const usedWords =
      config.usedWords || [];

    if (
      usedWords.includes(
        normalized,
      )
    ) {
      await recordUserFailure(
        client,
        message.guild.id,
        message.author.id,
      );

      await message.react(
        WORD_CHAIN_EMOJIS.wrong,
      ).catch(() => {});

      const warnMsg =
        await message.reply(
          `Bạn đã sử dụng một từ sai, xin vui lòng bắt đầu một từ mới với "${needed}". ${WORD_CHAIN_EMOJIS.wrongWord}`,
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
     * KHÔNG CÓ TRONG TỪ ĐIỂN
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
      );

      await message.react(
        WORD_CHAIN_EMOJIS.wrong,
      ).catch(() => {});

      const warnMsg =
        await message.reply(
          `Bạn đã sử dụng một từ sai, xin vui lòng bắt đầu một từ mới với "${needed}". ${WORD_CHAIN_EMOJIS.wrongWord}`,
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
     * ĐÚNG
     * =====================================================
     */

    await message.react(
      WORD_CHAIN_EMOJIS.correct,
    ).catch(() => {});

    /**
     * =====================================================
     * GHI NHẬN USER
     * =====================================================
     *
     * PvE:
     *
     * - V +1
     * - streak cá nhân +1
     * - BOT không tính streak
     *
     * PvP:
     *
     * - V +1
     * - streak chung +1
     */

    const afterUserSuccess =
      await recordUserSuccess(
        client,
        message.guild.id,
        message.author.id,
        normalized,
      );

    /**
     * =====================================================
     * PVP
     * =====================================================
     *
     * Người chơi trả lời đúng:
     *
     * → chỉ tick.
     *
     * Không gửi thông báo ngay.
     */

    if (
      config.mode === 'pvp'
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
       * ===================================================
       * KHÔNG CÒN TỪ ĐỂ NỐI
       * ===================================================
       */

      if (!nextWord) {
        const endedStreak =
          afterUserSuccess.currentStreak;

        const finalWord =
          normalized;

        const nextStart =
          getRandomStartWord();

        await recordBreak(
          client,
          message.guild.id,
          nextStart,
        );

        await message.channel.send(
          [
            `${WORD_CHAIN_EMOJIS.end} Quá siêu! Nối từ đã kết thúc sau chuỗi **${endedStreak}** với **${finalWord}** là từ cuối cùng.`,
            `${WORD_CHAIN_EMOJIS.newRound} Lượt nối từ mới đã bắt đầu với từ **${nextStart}**!`,
          ].join('\n'),
        ).catch(() => {});
      }

      return true;
    }

    /**
     * =====================================================
     * PVE / BOT
     * =====================================================
     *
     * streak ở đây là streak CÁ NHÂN của user.
     *
     * Ví dụ:
     *
     * User A → đúng = 1
     * Bot
     * User A → đúng = 2
     * Bot
     * User A → đúng = 3
     *
     * → Chuỗi hiện tại: 3
     *
     * Bot tuyệt đối không + streak.
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
        afterUserSuccess
          .personalStreaks
          ?.bot
          ?.[
            message.author.id
          ] ||
        0;

      const finalWord =
        normalized;

      const nextStart =
        getRandomStartWord();

      await recordBreak(
        client,
        message.guild.id,
        nextStart,
      );

      await message.channel.send(
        [
          `${WORD_CHAIN_EMOJIS.end} Quá siêu! Nối từ đã kết thúc sau chuỗi **${endedStreak}** với **${finalWord}** là từ cuối cùng.`,
          `${WORD_CHAIN_EMOJIS.newRound} Lượt nối từ mới đã bắt đầu với từ **${nextStart}**!`,
        ].join('\n'),
      ).catch(() => {});

      return true;
    }

    /**
     * =====================================================
     * BOT NỐI TIẾP
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

          /**
           * Nếu game đã:
           *
           * - restart
           * - disable
           * - đổi mode
           * - đổi currentWord
           *
           * thì bỏ lượt bot cũ.
           */

          if (
            !latestConfig.enabled ||
            latestConfig.mode !==
              'bot' ||
            latestConfig.currentWord !==
              normalized
          ) {
            return;
          }

          /**
           * Bot chỉ cập nhật currentWord.
           *
           * Không:
           *
           * - +V
           * - +X
           * - +streak
           */

          await recordBotSuccess(
            client,
            message.guild.id,
            botWord,
          );

          /**
           * Lấy state mới nhất.
           */

          const finalConfig =
            await getWordChainConfig(
              client,
              message.guild.id,
            );

          const personalStreak =
            Number(
              finalConfig
                .personalStreaks
                ?.bot
                ?.[
                  message.author.id
                ] || 0,
            );

          await message.channel.send(
            [
              `${WORD_CHAIN_EMOJIS.end} Vip pro! <@${message.author.id}> đã trả lời đúng!`,
              `${WORD_CHAIN_EMOJIS.botSuccess} Chuỗi hiện tại: **${personalStreak}**!`,
              `${WORD_CHAIN_EMOJIS.newRound} Lượt nối từ mới đã bắt đầu với từ **${botWord}**!`,
            ].join('\n'),
          ).catch(() => {});
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
          .catch(() => null);

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
