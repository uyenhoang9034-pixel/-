import { Events, MessageType, MessageFlags } from 'discord.js';

import { logger } from '../utils/logger.js';
import { handleBoostStarted } from '../services/boost/boostService.js';

import {
  getLevelingConfig,
  getUserLevelData,
} from '../services/leveling/leveling.js';

import {
  addXp,
} from '../services/leveling/xpSystem.js';

import {
  PRISON_ROLE_ID,
  CHAT_XP_DEFAULT_COOLDOWN_SECONDS,
  isValidChatActivityMessage,
} from '../config/leveling/levelingSystem.js';

import {
  Mutex,
} from '../utils/mutex.js';

import {
  checkRateLimit,
} from '../utils/rateLimiter.js';

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
  getWordChainNow,
  isWordChainNightLock,
  buildWordChainNightLockPayloadV2,
  tryConsumeNightLockNoticeCooldown,
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

import {
  handleEastMention,
} from '../services/eastMentionService.js';

import {
  handleDonateKeyword,
} from '../services/donate/donateService.js';

import {
  handleQuyenLoiCommand,
} from '../services/donate/quyenLoiService.js';

import {
  handleFinancialPrefix,
} from '../services/financial/financialLedgerService.js';

import {
  handleRoleIconPrefix,
  isRoleIconShopChannelAsync,
  refreshRoleIconShopPanel,
} from '../services/roleIconShopService.js';



import { pumpkinGrowthTracker } from '../services/pumpkinGrowthTracker.js';


const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;
const XIN_ITEM_THREAD_ID = '1547890357105070130';

const WORD_CHAIN_EMOJIS = {
  streak: '<a:trangtrig29:1546385117478527016>',
  correct: '✅',
  wrong: '❌',
  end: '<a:animeg2:1546040159886114846>',
  newRound: '<a:animeg3:1546040346717331477>',
  botSuccess: '<a:trangtrig19:1546068350030053406>',
  wrongWord: '<a:capybarag1:1546058369566122015>',
  wrongChain: '<a:meongg14:1546092766826864661>',
};

const BOOST_MESSAGE_TYPES = new Set([
  MessageType.UserPremiumGuildSubscription,
  MessageType.Tier1UserPremiumGuildSubscription,
  MessageType.Tier2UserPremiumGuildSubscription,
  MessageType.Tier3UserPremiumGuildSubscription,
  8, 9, 10, 11,
]);

export default {
  name: Events.MessageCreate,

  async execute(message, client) {
    try {
      if (!message.guild) {
        return;
      }

      // Bắt sự kiện tin nhắn hệ thống Discord Boost (MessageType: 8, 9, 10, 11)
      if (BOOST_MESSAGE_TYPES.has(message.type)) {
        await handleBoostSystemMessage(message);
        return;
      }

      if (message.author?.bot || message.system) {
        return;
      }

      const financialProcessed = await handleFinancialPrefix(message, client);
      if (financialProcessed) {
        return;
      }

      const roleIconProcessed = await handleRoleIconPrefix(message, client);
      if (roleIconProcessed) {
        return;
      }

      const quyenLoiProcessed = await handleQuyenLoiCommand(message);
      if (quyenLoiProcessed) {
        return;
      }

      // Giữ bảng Tiệm Role Icon luôn ở đáy kênh nếu có thành viên gửi tin nhắn thường trong kênh shop
      if (!message.author.bot && message.guild) {
        isRoleIconShopChannelAsync(message.guild.id, message.channel.id, client)
          .then((isShop) => {
            if (isShop) {
              refreshRoleIconShopPanel(client, message.guild, message.channel).catch(() => {});
            }
          })
          .catch(() => {});
      }

      await handleAutoReact(message, client);

      await handleEastMention(message);

      logger.debug(
        `Message received from ${message.author.tag}: ${message.content}`,
      );

      const wordChainProcessed = await handleWordChain(
        message,
        client,
      );

      if (wordChainProcessed) {
        return;
      }

      const donateProcessed = await handleDonateKeyword(message, client);
      if (donateProcessed) {
        return;
      }

      const guildConfig = await getGuildConfig(
        client,
        message.guild.id,
      );
      const prefix = guildConfig?.prefix || getCommandPrefix();

      const autoresponderProcessed = await handleAutoresponder(
        message,
        client,
      );

      let prefixCommandProcessed = false;
      if (!autoresponderProcessed) {
        prefixCommandProcessed = await handlePrefixCommand(message, client, {
          guildConfig,
          prefix,
        });
      }

      const isValidChatActivity =
        !prefixCommandProcessed &&
        isValidChatActivityMessage(message, { prefix });

      if (!isValidChatActivity) {
        return;
      }

      const member =
        message.member ||
        (await message.guild.members.fetch(message.author.id).catch(() => null));

      if (member?.roles?.cache?.has(PRISON_ROLE_ID)) {
        return;
      }

      // Ghi nhận nhiệm vụ tuần Witch Hunter: Mật Thư Chiến Trường (Chat)
      try {
        const { WitchHunterQuestService } = await import('../services/witchHunterQuestService.js');
        WitchHunterQuestService.onChatMessage(message, { prefix });
      } catch (questChatErr) {
        logger.warn('⚠️ [WitchHunterQuest] Lỗi ghi nhận tin nhắn:', questChatErr.message);
      }

      await handleLeveling(message, client, {
        member,
        prefix,
        alreadyValidated: true,
      });
    } catch (error) {
      logger.error('Error in messageCreate event:', error);
    }
  },
};

async function handlePrefixCommand(message, client, context = {}) {
  try {
    const guildConfig =
      context.guildConfig ||
      (await getGuildConfig(
        client,
        message.guild.id,
      ));

    const prefix =
      context.prefix || guildConfig?.prefix || getCommandPrefix();
    const parsed = parsePrefixCommand(message.content, prefix);

    if (!parsed) {
      return false;
    }

    let { commandName, args } = parsed;
    const musicPrefixShortcut = commandName.toLowerCase();
    const MUSIC_PREFIX_SHORTCUTS = new Set([
      'leave',
      'pause',
      'resume',
      'skip',
      'stop',
      'volume',
    ]);

    if (MUSIC_PREFIX_SHORTCUTS.has(musicPrefixShortcut)) {
      commandName = 'music';
      args = [musicPrefixShortcut, ...args];
    }

    logger.info(
      `Prefix command detected: ${commandName}, args: ${args.join(', ')}`,
    );

    let resolvedCommandName = resolveCommandAlias(commandName);
    const firstArgSubcommand = args[0]
      ? resolveSubcommandAlias(String(args[0]).toLowerCase())
      : null;

    if (
      resolvedCommandName === 'birthday' &&
      ['set', 'remove', 'send', 'setchannel'].includes(firstArgSubcommand)
    ) {
      resolvedCommandName = 'birthday-admin';
    } else if (
      resolvedCommandName === 'duel' &&
      firstArgSubcommand === 'test'
    ) {
      resolvedCommandName = 'duel-admin';
    } else if (
      resolvedCommandName === 'noitu' &&
      ['setup', 'mode', 'disable'].includes(firstArgSubcommand)
    ) {
      resolvedCommandName = 'noitu-admin';
    }

    const command = client.commands.get(resolvedCommandName);

    if (!command) {
      logger.warn(`Command not found: ${resolvedCommandName}`);
      return false;
    }

    if (isMaintenanceMode() && !isBotOwner(message.author.id)) {
      await message.channel
        .send({
          embeds: [
            createEmbed({
              title: 'Maintenance Mode',
              description: getBotMessage('maintenanceMode'),
              color: 'warning',
            }),
          ],
        })
        .catch(() => {});
      return true;
    }

    if (!isCommandCategoryEnabled(command.category)) {
      await message.channel
        .send({
          embeds: [
            createEmbed({
              title: 'Feature Disabled',
              description: getBotMessage('commandDisabled'),
              color: 'error',
            }),
          ],
        })
        .catch(() => {});
      return true;
    }

    const restriction = getPrefixRestriction(
      command,
      args,
      resolveSubcommandAlias,
    );

    if (!supportsPrefixExecution(command) || restriction.blocked) {
      if (restriction.blocked && restriction.reason) {
        await message.channel
          .send({
            embeds: [
              createEmbed({
                title: 'Slash Command Only',
                description: `${restriction.reason}\nUse \`/${resolvedCommandName}\` instead.`,
                color: 'info',
              }),
            ],
          })
          .catch(() => {});
      }
      return true;
    }

    if (
      !(await isCommandEnabled(
        client,
        message.guild.id,
        resolvePrefixAccessKey(command.data, args),
        command.category,
      ))
    ) {
      await message.channel
        .send({
          embeds: [
            createEmbed({
              title: 'Command Disabled',
              description: 'This command has been disabled for this server.',
              color: 'error',
            }),
          ],
        })
        .catch(() => {});
      return true;
    }

    const mockInteractionForProtection = {
      guildId: message.guild.id,
      user: message.author,
    };

    const abuseProtection = await enforceAbuseProtection(
      mockInteractionForProtection,
      command,
      resolvedCommandName,
    );

    if (!abuseProtection.allowed) {
      const formattedCooldown = formatCooldownDuration(
        abuseProtection.remainingMs,
      );

      await message.channel
        .send({
          embeds: [
            createEmbed({
              title: 'Command Cooldown',
              description: `This command is on cooldown. Please wait ${formattedCooldown} before trying again.`,
              color: 'error',
            }),
          ],
        })
        .catch(() => {});
      return true;
    }

    await executePrefixCommand(
      command,
      message,
      args,
      client,
      prefix,
      guildConfig,
    );
    return true;
  } catch (error) {
    logger.error('Error handling prefix command:', error);
    return false;
  }
}


export async function handleWordChain(message, client) {
  try {
    const mode = getWordChainModeForChannel(message.channel.id);

    if (!mode) {
      return false;
    }

    const config = await getWordChainConfig(
      client,
      message.guild.id,
    );
    const game = getWordChainGame(config, mode);

    if (!config.enabled || !game.enabled) {
      return false;
    }

    const content = message.content.trim();

    if (!content) {
      return false;
    }

    if (
      content.startsWith('/') ||
      content.startsWith('!') ||
      content.startsWith('.')
    ) {
      return false;
    }

    const normalized = normalizeWord(content);

    if (!normalized) {
      return false;
    }

    const parts = normalized.split(/\s+/).filter(Boolean);

    if (
      parts.length !== 2 ||
      !parts.every(part => /^\p{L}+$/u.test(part))
    ) {
      return false;
    }

    const nowMs = getWordChainNow(client);
    const nightStatus = isWordChainNightLock(nowMs);
    if (nightStatus.locked) {
      if (tryConsumeNightLockNoticeCooldown(message.channel.id, nowMs)) {
        await message.channel
          .send(
            buildWordChainNightLockPayloadV2({
              currentTimeText: nightStatus.currentTimeText,
              startHour: nightStatus.startHour,
              endHour: nightStatus.endHour,
              ephemeral: false,
            }),
          )
          .catch(() => {});
      }
      return true;
    }

    const needed = getLastSyllable(game.currentWord);

    if (mode === 'pvp' && game.lastUserId === message.author.id) {
      await recordUserFailure(
        client,
        message.guild.id,
        message.author.id,
        mode,
      );
      await message.react(WORD_CHAIN_EMOJIS.wrong).catch(() => {});

      const warnMsg = await message
        .reply(
          `Bạn đã sử dụng một từ không khớp với lượt chơi. Hãy để người chơi khác nối tiếp từ **${needed}**! ${WORD_CHAIN_EMOJIS.wrongChain}`,
        )
        .catch(() => null);

      if (warnMsg) {
        setTimeout(() => warnMsg.delete().catch(() => {}), 6000);
      }
      return true;
    }

    if (
      game.currentWord &&
      !canChain(game.currentWord, normalized)
    ) {
      await recordUserFailure(
        client,
        message.guild.id,
        message.author.id,
        mode,
      );
      await message.react(WORD_CHAIN_EMOJIS.wrong).catch(() => {});

      const warnMsg = await message
        .reply(
          `Bạn đã sử dụng một từ không khớp với từ trước đó. Bạn cần bắt đầu bằng **${needed}**! ${WORD_CHAIN_EMOJIS.wrongChain}`,
        )
        .catch(() => null);

      if (warnMsg) {
        setTimeout(() => warnMsg.delete().catch(() => {}), 6000);
      }
      return true;
    }

    const usedWords = game.usedWords || [];

    if (usedWords.includes(normalized)) {
      await recordUserFailure(
        client,
        message.guild.id,
        message.author.id,
        mode,
      );
      await message.react(WORD_CHAIN_EMOJIS.wrong).catch(() => {});

      const warnMsg = await message
        .reply(
          `Bạn đã sử dụng từ này rồi. Hãy bắt đầu một từ mới với **${needed}**! ${WORD_CHAIN_EMOJIS.wrongWord}`,
        )
        .catch(() => null);

      if (warnMsg) {
        setTimeout(() => warnMsg.delete().catch(() => {}), 6000);
      }
      return true;
    }

    const validUserWord = isValidWord(normalized);

    if (!validUserWord) {
      await recordUserFailure(
        client,
        message.guild.id,
        message.author.id,
        mode,
      );
      await message.react(WORD_CHAIN_EMOJIS.wrong).catch(() => {});

      const warnMsg = await message
        .reply(
          `Từ này không hợp lệ. Hãy bắt đầu một từ mới với **${needed}**! ${WORD_CHAIN_EMOJIS.wrongWord}`,
        )
        .catch(() => null);

      if (warnMsg) {
        setTimeout(() => warnMsg.delete().catch(() => {}), 6000);
      }
      return true;
    }

    const afterUserSuccess = await recordUserSuccess(
      client,
      message.guild.id,
      message.author.id,
      normalized,
      mode,
    );

    if (!afterUserSuccess?.__wordChainAccepted) {
      return true;
    }

    await message.react(WORD_CHAIN_EMOJIS.correct).catch(() => {});

    if (mode === 'pvp') {
      const nextWord = findBotNextWord(
        normalized,
        [...usedWords, normalized],
      );

      if (!nextWord) {
        const endedStreak = Number(
          afterUserSuccess.games?.pvp?.currentStreak || 0,
        );
        const finalWord = normalized;
        const nextStart = getRandomStartWord();

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

    const updatedUsedWords = [...usedWords, normalized];
    const botWord = findBotNextWord(
      normalized,
      updatedUsedWords,
    );

    if (!botWord) {
      const endedStreak = Number(
        afterUserSuccess.games?.bot?.personalStreaks?.[
          message.author.id
        ] || 0,
      );
      const finalWord = normalized;
      const nextStart = getRandomStartWord();

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

    setTimeout(async () => {
      try {
        if (isWordChainNightLock(getWordChainNow(client)).locked) {
          return;
        }

        const latestConfig = await getWordChainConfig(
          client,
          message.guild.id,
        );
        const latestGame = getWordChainGame(latestConfig, 'bot');

        if (
          !latestConfig.enabled ||
          !latestGame.enabled ||
          latestGame.currentWord !== normalized
        ) {
          return;
        }

        const validBotWord = isValidWord(botWord);

        if (!validBotWord) {
          return;
        }

        const latestUsedWords = latestGame.usedWords || [];

        if (latestUsedWords.includes(botWord)) {
          return;
        }

        await recordBotSuccess(
          client,
          message.guild.id,
          botWord,
          'bot',
        );

        const finalConfig = await getWordChainConfig(
          client,
          message.guild.id,
        );
        const finalGame = getWordChainGame(finalConfig, 'bot');
        const personalStreak = Number(
          finalGame.personalStreaks?.[message.author.id] || 0,
        );

        await message.channel
          .send(
            [
              `${WORD_CHAIN_EMOJIS.botSuccess} **${botWord}**`,
              `${WORD_CHAIN_EMOJIS.streak} <@${message.author.id}> — Chuỗi hiện tại: **${personalStreak}**!`,
              `${WORD_CHAIN_EMOJIS.newRound} Tiếng tiếp theo: **${getLastSyllable(botWord)}**`,
            ].join('\n'),
          )
          .catch(() => {});

        const afterBotConfig = await getWordChainConfig(
          client,
          message.guild.id,
        );
        const afterBotGame = getWordChainGame(afterBotConfig, 'bot');
        const nextPossibleWord = findBotNextWord(
          afterBotGame.currentWord,
          afterBotGame.usedWords || [],
        );

        if (!nextPossibleWord) {
          const nextStart = getRandomStartWord();

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
    }, 1000);

    return true;
  } catch (error) {
    logger.error('Error handling word chain:', error);
    return false;
  }
}

async function handleLeveling(message, client, options = {}) {
  try {
    let {
      member = message.member || null,
      prefix = null,
      alreadyValidated = false,
    } = options;

    if (!alreadyValidated) {
      if (prefix === null) {
        const guildConfig = await getGuildConfig(
          client,
          message.guild.id,
        );
        prefix = guildConfig?.prefix || getCommandPrefix();
      }

      if (!isValidChatActivityMessage(message, { prefix })) {
        return;
      }
    }

    if (!member) {
      member = await message.guild.members
        .fetch(message.author.id)
        .catch(() => null);
    }

    if (!member || member.roles?.cache?.has(PRISON_ROLE_ID)) {
      return;
    }

    const levelingConfig = await getLevelingConfig(
      client,
      message.guild.id,
    );

    if (!levelingConfig?.enabled) {
      return;
    }

    if (levelingConfig.ignoredChannels?.includes(message.channel.id)) {
      return;
    }

    if (
      levelingConfig.ignoredRoles?.length > 0 &&
      member.roles.cache.some(role =>
        levelingConfig.ignoredRoles.includes(role.id),
      )
    ) {
      return;
    }

    if (
      levelingConfig.blacklistedUsers?.includes(message.author.id)
    ) {
      return;
    }

    const cooldownTime =
      levelingConfig.xpCooldown ?? CHAT_XP_DEFAULT_COOLDOWN_SECONDS;

    const chatLockKey = `chat-xp:${message.guild.id}:${message.author.id}`;

    await Mutex.runExclusive(chatLockKey, async () => {
      const userData = await getUserLevelData(
        client,
        message.guild.id,
        message.author.id,
      );

      const now = Date.now();
      const timeSinceLastMessage = now - (userData.lastMessage || 0);

      if (timeSinceLastMessage < cooldownTime * 1000) {
        return;
      }

      const rateLimitKey = `xp-event:${message.guild.id}:${message.author.id}`;
      const canProcess = await checkRateLimit(
        rateLimitKey,
        MESSAGE_XP_RATE_LIMIT_ATTEMPTS,
        MESSAGE_XP_RATE_LIMIT_WINDOW_MS,
      );

      if (!canProcess) {
        return;
      }

      const minXP =
        levelingConfig.xpRange?.min ||
        levelingConfig.xpPerMessage?.min ||
        15;
      const maxXP =
        levelingConfig.xpRange?.max ||
        levelingConfig.xpPerMessage?.max ||
        25;

      const safeMinXP = Math.max(1, minXP);
      const safeMaxXP = Math.max(safeMinXP, maxXP);
      const xpToGive =
        Math.floor(
          Math.random() * (safeMaxXP - safeMinXP + 1),
        ) + safeMinXP;

      let finalXP = xpToGive;

      if (
        levelingConfig.xpMultiplier &&
        levelingConfig.xpMultiplier > 1
      ) {
        finalXP = Math.floor(
          finalXP * levelingConfig.xpMultiplier,
        );
      }

      const result = await addXp(
        client,
        message.guild,
        member,
        finalXP,
        { source: 'chat' },
      );

      // Đồng bộ Daily Report với đúng những tin nhắn hợp lệ được tính XP
      if (result) {
        pumpkinGrowthTracker.recordChatMessage(message.author.id);
      }

      if (result?.leveledUp) {
        logger.info(
          `${message.author.tag} leveled up to level ${result.level} in ${message.guild.name}`,
        );
      }
    });
  } catch (error) {
    logger.error('Error handling leveling for message:', error);
  }
}

async function handleAutoresponder(message, client) {
  try {
    if (!message.guild || !message.content?.trim()) {
      return false;
    }

    const config = await getAutoresponderConfig(
      client,
      message.guild.id,
    );

    const responder = findMatchingResponder(
      message.content,
      config.responders,
    );

    if (!responder) {
      return false;
    }

    const responderKeyword = String(
      responder.keyword || '',
    )
      .trim()
      .toLowerCase();

    if (
      responderKeyword === 'xin' &&
      message.channel.id !== XIN_ITEM_THREAD_ID
    ) {
      return false;
    }

    let member = message.member;
    if (!member && message.guild) {
      try {
        member = await message.guild.members.fetch(message.author.id);
      } catch (fetchErr) {
        logger.debug('Failed to fetch guild member for autoresponder:', fetchErr);
      }
    }

    if (
      !canTriggerResponder(
        member,
        responder,
        config,
      )
    ) {
      return false;
    }

    // Kiểm tra và lấy danh sách người dùng và vai trò (roles) được tag chỉ định
    const shouldMentionTarget = responder.response?.mentionTarget !== false;
    let targetMentionText = '';
    if (shouldMentionTarget) {
      const mentions = [];
      const targetUsers = message.mentions.users.filter(u => u.id !== client.user.id);
      if (targetUsers.size > 0) {
        mentions.push(...targetUsers.map(u => `<@${u.id}>`));
      }
      if (message.mentions.roles && message.mentions.roles.size > 0) {
        mentions.push(...message.mentions.roles.map(r => `<@&${r.id}>`));
      }
      targetMentionText = mentions.join(' ');
    }

    // Tùy chọn xóa tin nhắn kích hoạt (ví dụ xóa lệnh lvup1)
    const shouldDeleteTrigger = responder.response?.deleteTrigger === true;
    if (shouldDeleteTrigger) {
      await message.delete().catch(err => {
        logger.debug('Failed to delete autoresponder trigger message:', err);
      });
    }

    const payload = buildDiscordMessagePayload(
      responder.response,
      { targetMentionText },
    );

    // Đảm bảo không tồn tại trường content nếu dùng MessageFlags.IsComponentsV2 (tránh lỗi MESSAGE_CANNOT_USE_LEGACY_FIELDS_WITH_COMPONENTS_V2)
    if (payload.flags && (payload.flags & MessageFlags.IsComponentsV2)) {
      delete payload.content;
    }

    // Đảm bảo allowedMentions hợp lệ với Discord API (cho phép ping cả users và roles)
    const existingParse = Array.isArray(payload.allowedMentions?.parse)
      ? payload.allowedMentions.parse
      : [];

    payload.allowedMentions = {
      ...payload.allowedMentions,
      parse: Array.from(new Set([...existingParse, 'users', 'roles'])),
    };
    delete payload.allowedMentions.users;
    delete payload.allowedMentions.roles;

    // Chỉ reply nếu tin nhắn lệnh KHÔNG bị xóa
    if (!shouldDeleteTrigger && responder.response?.reply?.enabled) {
      payload.reply = {
        messageReference: message.id,
        failIfNotExists: false,
        allowedMentions: {
          repliedUser:
            responder.response?.reply?.mentionAuthor === true,
        },
      };
    }

    await message.channel.send(payload);

    logger.info('Autoresponder triggered', {
      guildId: message.guild.id,
      channelId: message.channel.id,
      userId: message.author.id,
      responderId: responder.id,
      keyword: responder.displayKeyword || responder.keyword,
    });

    return true;
  } catch (error) {
    logger.error('Error handling autoresponder:', error);
    return false;
  }
}

async function handleAutoReact(message, client) {
  try {
    if (!message.guild || !message.content?.trim()) {
      return;
    }

    const config = await getAutoReactConfig(
      client,
      message.guild.id,
    );

    if (
      !config.enabled ||
      !Array.isArray(config.reactions) ||
      config.reactions.length === 0
    ) {
      return;
    }

    const matches = findMatchingAutoReacts(
      message.content,
      config.reactions,
    );

    if (!Array.isArray(matches) || matches.length === 0) {
      return;
    }

    const reactedEmojiIds = new Set();

    for (const reaction of matches) {
      const emojis = Array.isArray(reaction.emojis)
        ? reaction.emojis
        : [];

      if (emojis.length === 0) {
        continue;
      }

      for (const emojiData of emojis) {
        if (!emojiData || !emojiData.id) {
          continue;
        }

        if (reactedEmojiIds.has(emojiData.id)) {
          continue;
        }

        const emoji = message.guild.emojis.cache.get(
          emojiData.id,
        );

        if (!emoji) {
          logger.warn('Auto React emoji not found in guild', {
            guildId: message.guild.id,
            channelId: message.channel.id,
            keyword:
              reaction.displayKeyword || reaction.keyword,
            emojiId: emojiData.id,
            emojiName: emojiData.name || null,
          });
          continue;
        }

        try {
          await message.react(emoji);
          reactedEmojiIds.add(emojiData.id);

          logger.debug('Auto React added', {
            guildId: message.guild.id,
            channelId: message.channel.id,
            messageId: message.id,
            keyword:
              reaction.displayKeyword || reaction.keyword,
            emojiId: emojiData.id,
            emojiName: emoji.name || emojiData.name || null,
          });
        } catch (error) {
          logger.warn('Failed to add Auto React', {
            guildId: message.guild.id,
            channelId: message.channel.id,
            messageId: message.id,
            keyword:
              reaction.displayKeyword || reaction.keyword,
            emojiId: emojiData.id,
            emojiName: emoji.name || emojiData.name || null,
            error: error?.message || String(error),
          });
        }
      }
    }
  } catch (error) {
    logger.error('Error handling auto-react:', error);
  }
}

async function handleBoostSystemMessage(message) {
  try {
    const member =
      message.member ||
      (await message.guild.members.fetch(message.author.id).catch(() => null));

    if (!member) {
      logger.warn(
        `[Boost] Received boost system message but could not resolve member ${message.author?.id}`,
      );
      return;
    }

    logger.info(
      `[Boost] Detected boost system message (type: ${message.type}) from ${member.user.tag} (${member.id}) in ${message.guild.name}`,
    );

    await handleBoostStarted(member);
  } catch (err) {
    logger.error('[Boost] Error processing boost system message:', err);
  }
}
