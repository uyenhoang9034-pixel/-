import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';

import { logger } from '../utils/logger.js';

export const IS_COMPONENTS_V2 = MessageFlags.IsComponentsV2 || (1 << 15);

export const WORD_CHAIN_NIGHT_LOCK = Object.freeze({
  START_HOUR: 0,
  END_HOUR: 8,
  TIMEZONE: 'Asia/Ho_Chi_Minh',
});

export const WORD_CHAIN_NIGHT_EMOJIS = Object.freeze({
  TITLE_LEFT: '<a:trangtrig2:1546040703375904801>',
  TITLE_RIGHT: '<a:trangtrig3:1546040818261954610>',
  TIME: '<:trangtri2:1567819836279492652>',
  ADMIN_DISABLE: '<a:bang3:1546891744237461635>',
  NOTEBOOK: '<a:trangtrig18:1546068102817775626>',
});


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const WORD_CHAIN_CHANNELS = {
  pvp: '1545291672504508416',
  bot: '1546428675367505920',
};

export const WORD_CHAIN_HINT_LIMIT = 3;

export const WORD_CHAIN_MODES = {
  pvp: {
    label: 'Đấu với người chơi (PvP)',
    description:
      'Các thành viên trong server thay phiên nhau nối từ.',
    value: 'pvp',
  },

  bot: {
    label: 'Đấu với Bot (PvE)',
    description:
      'Người chơi nối từ, Bot sẽ tự động tìm từ nối tiếp.',
    value: 'bot',
  },
};

const WORD_CHAIN_KEY_PREFIX = 'wordChain:';

const stateQueues = new Map();

function getQueueKey(guildId, mode = 'all') {
  return `${guildId}:${mode}`;
}

function withStateLock(guildId, mode, task) {
  const key = getQueueKey(guildId, mode);

  const previous =
    stateQueues.get(key) ||
    Promise.resolve();

  const current =
    previous
      .catch(() => {})
      .then(task);

  stateQueues.set(key, current);

  return current.finally(() => {
    if (stateQueues.get(key) === current) {
      stateQueues.delete(key);
    }
  });
}

let validWordsSet = new Set();
let startWordMap = new Map();
let dictionaryLoaded = false;
let dictionaryIdleTimer = null;
const DICTIONARY_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 giờ không có hoạt động sẽ giải phóng RAM

function resetDictionaryIdleTimer() {
  if (dictionaryIdleTimer) {
    clearTimeout(dictionaryIdleTimer);
  }
  dictionaryIdleTimer = setTimeout(() => {
    unloadDictionary();
  }, DICTIONARY_IDLE_TIMEOUT_MS);

  if (typeof dictionaryIdleTimer?.unref === 'function') {
    dictionaryIdleTimer.unref();
  }
}

export function isDictionaryLoaded() {
  return dictionaryLoaded;
}

export function unloadDictionary(reason = 'idle') {
  if (!dictionaryLoaded && validWordsSet.size === 0) {
    return;
  }

  validWordsSet.clear();
  startWordMap.clear();
  validWordsSet = new Set();
  startWordMap = new Map();
  dictionaryLoaded = false;

  if (dictionaryIdleTimer) {
    clearTimeout(dictionaryIdleTimer);
    dictionaryIdleTimer = null;
  }

  if (reason === 'night_lock') {
    logger.info(
      '[WordChain] Bước vào khung giờ nghỉ ban đêm (00:00 - 08:00). Đã giải phóng từ điển khỏi RAM (~30MB - 50MB).',
    );
  } else {
    logger.info(
      '[WordChain] Không có lượt chơi nối từ trong 2 giờ. Đã giải phóng từ điển khỏi RAM (~30MB - 50MB) để dọn dẹp bộ nhớ.',
    );
  }

  if (typeof global.gc === 'function') {
    try {
      global.gc();
    } catch {}
  }
}

export function ensureDictionaryLoaded() {
  if (!dictionaryLoaded) {
    initDictionary();
  } else {
    resetDictionaryIdleTimer();
  }

  return dictionaryLoaded;
}

export function normalizeWord(word) {
  if (typeof word !== 'string') {
    return '';
  }

  return word
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function initDictionary() {
  if (dictionaryLoaded) {
    resetDictionaryIdleTimer();
    return true;
  }

  const dictPath = path.join(
    __dirname,
    '../data/vietnamese_words.json',
  );

  try {
    if (!fs.existsSync(dictPath)) {
      throw new Error(
        `Word Chain dictionary file not found: ${dictPath}`,
      );
    }

    const rawData = fs.readFileSync(dictPath, 'utf8');
    const words = JSON.parse(rawData.replace(/^\uFEFF/, ''));

    if (!Array.isArray(words)) {
      throw new Error(
        'Word Chain dictionary must be a JSON array.',
      );
    }

    const nextValidWords = new Set();
    const nextStartWordMap = new Map();

    for (const word of words) {
      const cleaned = normalizeWord(word);

      if (!cleaned) {
        continue;
      }

      const parts = cleaned.split(' ');

      if (
        parts.length !== 2 ||
        !parts.every(part => /^\p{L}+$/u.test(part))
      ) {
        continue;
      }

      nextValidWords.add(cleaned);

      const first = parts[0];

      if (!nextStartWordMap.has(first)) {
        nextStartWordMap.set(first, []);
      }

      nextStartWordMap.get(first).push(cleaned);
    }

    if (nextValidWords.size === 0) {
      throw new Error(
        'Word Chain dictionary loaded 0 valid two-syllable words.',
      );
    }

    validWordsSet = nextValidWords;
    startWordMap = nextStartWordMap;
    dictionaryLoaded = true;
    resetDictionaryIdleTimer();

    logger.info(
      `[WordChain] Lazy-loaded dictionary: ${validWordsSet.size} words | source: src/data/vietnamese_words.json`,
    );

    return true;
  } catch (error) {
    validWordsSet = new Set();
    startWordMap = new Map();
    dictionaryLoaded = false;

    if (dictionaryIdleTimer) {
      clearTimeout(dictionaryIdleTimer);
      dictionaryIdleTimer = null;
    }

    logger.error(
      '[WordChain] Dictionary load error:',
      error,
    );

    return false;
  }
}

// KHÔNG nạp từ điển khi bot khởi động (Lazy-Loading).
// Từ điển sẽ được nạp vào RAM khi người chơi dùng /noitu hoặc gửi tin nhắn vào kênh nối từ.

function createDefaultGame(mode) {
  return {
    enabled: false,

    channelId:
      WORD_CHAIN_CHANNELS[mode] ||
      null,

    mode,

    currentWord: null,

    lastUserId: null,

    usedWords: [],

    currentStreak: 0,

    bestStreak: 0,

    personalStreaks: {},

    hintUses: {},
  };
}

const DEFAULT_WORD_CHAIN_CONFIG = {
  enabled: false,

  channelId: null,

  mode: 'bot',

  games: {
    pvp: createDefaultGame('pvp'),
    bot: createDefaultGame('bot'),
  },

  leaderboard: {
    bot: {},
    pvp: {},
  },
};

function toNonNegativeNumber(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return 0;
  }

  return number;
}

function normalizePersonalStreaks(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {};
  }

  const result = {};

  for (
    const [userId, streak]
    of Object.entries(value)
  ) {
    result[userId] =
      toNonNegativeNumber(streak);
  }

  return result;
}

function normalizeHintUses(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {};
  }

  const result = {};

  for (
    const [userId, uses]
    of Object.entries(value)
  ) {
    result[userId] =
      Math.min(
        WORD_CHAIN_HINT_LIMIT,
        toNonNegativeNumber(uses),
      );
  }

  return result;
}

function normalizeLeaderboardMode(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {};
  }

  const result = {};

  for (
    const [userId, rawStats]
    of Object.entries(value)
  ) {
    if (
      rawStats &&
      typeof rawStats === 'object' &&
      !Array.isArray(rawStats)
    ) {
      result[userId] = {
        correct:
          toNonNegativeNumber(
            rawStats.correct,
          ),

        wrong:
          toNonNegativeNumber(
            rawStats.wrong,
          ),

        bestStreak:
          toNonNegativeNumber(
            rawStats.bestStreak,
          ),
      };

      continue;
    }

    result[userId] = {
      correct:
        toNonNegativeNumber(
          rawStats,
        ),

      wrong: 0,

      bestStreak: 0,
    };
  }

  return result;
}

function normalizeGame(rawGame, mode) {
  const game = {
    ...createDefaultGame(mode),

    ...(rawGame &&
    typeof rawGame === 'object'
      ? rawGame
      : {}),
  };

  game.mode = mode;

  game.channelId =
    WORD_CHAIN_CHANNELS[mode];

  game.enabled =
    Boolean(game.enabled);

  game.currentWord =
    game.currentWord
      ? normalizeWord(
          game.currentWord,
        )
      : null;

  game.lastUserId =
    typeof game.lastUserId ===
    'string'
      ? game.lastUserId
      : null;

  game.usedWords =
    Array.isArray(game.usedWords)
      ? [
          ...new Set(
            game.usedWords
              .map(normalizeWord)
              .filter(Boolean),
          ),
        ]
      : [];

  game.currentStreak =
    toNonNegativeNumber(
      game.currentStreak,
    );

  game.bestStreak =
    toNonNegativeNumber(
      game.bestStreak,
    );

  game.personalStreaks =
    normalizePersonalStreaks(
      game.personalStreaks,
    );

  game.hintUses =
    normalizeHintUses(
      game.hintUses,
    );

  return game;
}

function normalizeWordChainConfig(state) {
  const raw =
    state &&
    typeof state === 'object' &&
    !Array.isArray(state)
      ? state
      : {};

  let games;

  if (
    raw.games &&
    typeof raw.games === 'object'
  ) {
    games = {
      pvp:
        normalizeGame(
          raw.games.pvp,
          'pvp',
        ),

      bot:
        normalizeGame(
          raw.games.bot,
          'bot',
        ),
    };
  } else {
    const oldMode =
      raw.mode === 'pvp'
        ? 'pvp'
        : 'bot';

    const migratedGame =
      normalizeGame(
        {
          enabled:
            Boolean(raw.enabled),

          currentWord:
            raw.currentWord,

          lastUserId:
            raw.lastUserId,

          usedWords:
            raw.usedWords,

          currentStreak:
            raw.currentStreak,

          bestStreak:
            raw.bestStreak,

          personalStreaks:
            raw.personalStreaks?.[
              oldMode
            ] ??
            raw.personalStreaks,

          hintUses:
            raw.hintUses?.[
              oldMode
            ] ??
            raw.hintUses,
        },

        oldMode,
      );

    games = {
      pvp:
        createDefaultGame(
          'pvp',
        ),

      bot:
        createDefaultGame(
          'bot',
        ),
    };

    games[oldMode] =
      migratedGame;
  }

  const rawLeaderboard =
    raw.leaderboard &&
    typeof raw.leaderboard ===
      'object' &&
    !Array.isArray(
      raw.leaderboard,
    )
      ? raw.leaderboard
      : {};

  const hasModeLeaderboards =
    rawLeaderboard.bot !==
      undefined ||
    rawLeaderboard.pvp !==
      undefined;

  const leaderboard =
    hasModeLeaderboards
      ? {
          bot:
            normalizeLeaderboardMode(
              rawLeaderboard.bot,
            ),

          pvp:
            normalizeLeaderboardMode(
              rawLeaderboard.pvp,
            ),
        }
      : {
          bot:
            normalizeLeaderboardMode(
              rawLeaderboard,
            ),

          pvp: {},
        };

  return {
    ...DEFAULT_WORD_CHAIN_CONFIG,
    ...raw,

    enabled:
      Boolean(
        games.pvp.enabled ||
        games.bot.enabled,
      ),

    games,
    leaderboard,

    channelId:
      typeof raw.channelId ===
        'string'
        ? raw.channelId
        : null,

    mode:
      raw.mode === 'pvp'
        ? 'pvp'
        : 'bot',
  };
}

export function getWordChainModeForChannel(
  channelId,
) {
  if (
    channelId ===
    WORD_CHAIN_CHANNELS.pvp
  ) {
    return 'pvp';
  }

  if (
    channelId ===
    WORD_CHAIN_CHANNELS.bot
  ) {
    return 'bot';
  }

  return null;
}

export function getFirstSyllable(word) {
  const parts =
    normalizeWord(word)
      .split(' ');

  return parts.length === 2
    ? parts[0]
    : '';
}

export function getLastSyllable(word) {
  const parts =
    normalizeWord(word)
      .split(' ');

  return parts.length === 2
    ? parts[1]
    : '';
}

export function isValidWord(word) {
  if (!ensureDictionaryLoaded()) {
    return false;
  }

  const cleaned = normalizeWord(word);

  if (!cleaned) {
    return false;
  }

  const parts = cleaned.split(' ');

  if (
    parts.length !== 2 ||
    !parts.every(part => /^\p{L}+$/u.test(part))
  ) {
    return false;
  }

  return validWordsSet.has(cleaned);
}

export function canChain(
  prevWord,
  nextWord,
) {
  if (
    !prevWord ||
    !nextWord
  ) {
    return true;
  }

  const previous =
    normalizeWord(prevWord)
      .split(' ');

  const next =
    normalizeWord(nextWord)
      .split(' ');

  if (
    previous.length !== 2 ||
    next.length !== 2
  ) {
    return false;
  }

  return (
    previous[1] ===
    next[0]
  );
}

export function findBotNextWord(
  prevWord,
  usedWords = [],
) {
  if (!ensureDictionaryLoaded()) {
    return null;
  }

  const firstSyllable =
    getLastSyllable(
      prevWord,
    );

  if (!firstSyllable) {
    return null;
  }

  const candidates =
    startWordMap.get(
      firstSyllable,
    );

  if (
    !candidates ||
    candidates.length === 0
  ) {
    return null;
  }

  const usedSet =
    new Set(
      Array.isArray(usedWords)
        ? usedWords
            .map(normalizeWord)
            .filter(Boolean)
        : [],
    );

  const available =
    candidates.filter(
      word =>
        !usedSet.has(word),
    );

  if (
    available.length === 0
  ) {
    return null;
  }

  return available[
    Math.floor(
      Math.random() *
        available.length,
    )
  ];
}

export function getRandomStartWord(
  excludeWords = [],
) {
  if (!ensureDictionaryLoaded()) {
    return null;
  }

  const excluded =
    new Set(
      Array.isArray(excludeWords)
        ? excludeWords
            .map(normalizeWord)
            .filter(Boolean)
        : [],
    );

  const available =
    Array.from(
      validWordsSet,
    ).filter(
      word =>
        !excluded.has(word),
    );

  if (available.length > 0) {
    return available[
      Math.floor(
        Math.random() *
          available.length,
      )
    ];
  }

  const allWords =
    Array.from(
      validWordsSet,
    );

  if (allWords.length > 0) {
    return allWords[
      Math.floor(
        Math.random() *
          allWords.length,
      )
    ];
  }

  return null;
}

function getStorageKey(guildId) {
  return `${WORD_CHAIN_KEY_PREFIX}${guildId}`;
}

export async function getWordChainConfig(
  client,
  guildId,
) {
  try {
    if (
      !client?.db ||
      typeof client.db.get !==
        'function'
    ) {
      logger.warn(
        `Word Chain database unavailable for guild ${guildId}.`,
      );

      return normalizeWordChainConfig();
    }

    const rawState =
      await client.db.get(
        getStorageKey(guildId),
      );

    return normalizeWordChainConfig(
      rawState,
    );
  } catch (error) {
    logger.error(
      'Failed to load word chain config:',
      {
        guildId,
        error,
      },
    );

    return normalizeWordChainConfig();
  }
}

export async function saveWordChainConfig(
  client,
  guildId,
  state,
) {
  const normalized =
    normalizeWordChainConfig(
      state,
    );

  if (
    !client?.db ||
    typeof client.db.set !==
      'function'
  ) {
    throw new Error(
      'Word Chain database is unavailable.',
    );
  }

  const saved =
    await client.db.set(
      getStorageKey(guildId),
      normalized,
    );

  if (saved === false) {
    throw new Error(
      'Word Chain database rejected the write.',
    );
  }

  return normalized;
}

export function getWordChainGame(
  config,
  mode,
) {
  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  return normalizeGame(
    config?.games?.[
      resolvedMode
    ],

    resolvedMode,
  );
}

function chooseStartWord(
  startWord,
  excludeWords = [],
) {
  const normalized =
    startWord
      ? normalizeWord(
          startWord,
        )
      : '';

  if (
    normalized &&
    isValidWord(normalized)
  ) {
    return normalized;
  }

  return getRandomStartWord(
    excludeWords,
  );
}

function buildFreshGame(
  existingGame,
  mode,
  startWord,
) {
  const existing =
    normalizeGame(
      existingGame,
      mode,
    );

  return {
    ...createDefaultGame(mode),

    enabled: true,

    channelId:
      WORD_CHAIN_CHANNELS[mode],

    mode,

    currentWord:
      startWord,

    lastUserId:
      null,

    usedWords:
      startWord
        ? [startWord]
        : [],

    currentStreak:
      0,

    bestStreak:
      existing.bestStreak,

    personalStreaks:
      {},

    hintUses:
      {},
  };
}

export async function activateWordChain(
  client,
  guildId,
  channelId,
  mode = 'bot',
  startWord = null,
) {
  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  return withStateLock(
    guildId,
    resolvedMode,
    async () => {
      ensureDictionaryLoaded();

      const current =
        await getWordChainConfig(
          client,
          guildId,
        );

      const oldGame =
        getWordChainGame(
          current,
          resolvedMode,
        );

      const initialWord =
        chooseStartWord(
          startWord,
          oldGame.currentWord
            ? [
                oldGame.currentWord,
              ]
            : [],
        );

      current.games[
        resolvedMode
      ] =
        buildFreshGame(
          oldGame,
          resolvedMode,
          initialWord,
        );

      current.enabled =
        Boolean(
          current.games.pvp
            .enabled ||
          current.games.bot
            .enabled,
        );

      current.mode =
        resolvedMode;

      current.channelId =
        WORD_CHAIN_CHANNELS[
          resolvedMode
        ];

      return saveWordChainConfig(
        client,
        guildId,
        current,
      );
    },
  );
}

export async function disableWordChain(
  client,
  guildId,
) {
  return withStateLock(
    guildId,
    'all',
    async () => {
      const current =
        await getWordChainConfig(
          client,
          guildId,
        );

      current.games.pvp.enabled =
        false;

      current.games.bot.enabled =
        false;

      current.enabled =
        false;

      return saveWordChainConfig(
        client,
        guildId,
        current,
      );
    },
  );
}

export async function disableWordChainMode(
  client,
  guildId,
  mode,
) {
  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  return withStateLock(
    guildId,
    resolvedMode,
    async () => {
      const current =
        await getWordChainConfig(
          client,
          guildId,
        );

      current.games[
        resolvedMode
      ].enabled =
        false;

      current.enabled =
        Boolean(
          current.games.pvp
            .enabled ||
          current.games.bot
            .enabled,
        );

      return saveWordChainConfig(
        client,
        guildId,
        current,
      );
    },
  );
}

export async function resetWordChainGame(
  client,
  guildId,
  startWord = null,
  mode = 'bot',
) {
  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  return withStateLock(
    guildId,
    resolvedMode,
    async () => {
      ensureDictionaryLoaded();

      const current =
        await getWordChainConfig(
          client,
          guildId,
        );

      const existingGame =
        getWordChainGame(
          current,
          resolvedMode,
        );

      const initialWord =
        chooseStartWord(
          startWord,
          existingGame.currentWord
            ? [
                existingGame.currentWord,
              ]
            : [],
        );

      current.games[
        resolvedMode
      ] = {
        ...existingGame,

        enabled:
          existingGame.enabled,

        channelId:
          WORD_CHAIN_CHANNELS[
            resolvedMode
          ],

        mode:
          resolvedMode,

        currentWord:
          initialWord,

        lastUserId:
          null,

        usedWords:
          initialWord
            ? [initialWord]
            : [],

        currentStreak:
          0,

        bestStreak:
          existingGame.bestStreak,

        personalStreaks:
          {},

        hintUses:
          {},
      };

      current.enabled =
        Boolean(
          current.games.pvp
            .enabled ||
          current.games.bot
            .enabled,
        );

      return saveWordChainConfig(
        client,
        guildId,
        current,
      );
    },
  );
}

export async function useWordChainHint(
  client,
  guildId,
  userId,
  mode = 'bot',
) {
  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  return withStateLock(
    guildId,
    resolvedMode,
    async () => {
      const current =
        await getWordChainConfig(
          client,
          guildId,
        );

      const game =
        getWordChainGame(
          current,
          resolvedMode,
        );

      if (!game.enabled) {
        return {
          ok: false,
          reason: 'disabled',
          used: 0,
          remaining:
            WORD_CHAIN_HINT_LIMIT,
          word: null,
          config: current,
        };
      }

      const used =
        Math.min(
          WORD_CHAIN_HINT_LIMIT,
          toNonNegativeNumber(
            game.hintUses?.[
              userId
            ],
          ),
        );

      if (
        used >=
        WORD_CHAIN_HINT_LIMIT
      ) {
        return {
          ok: false,
          reason: 'limit',
          used,
          remaining: 0,
          word: null,
          config: current,
        };
      }

      /**
       * Gợi ý cũng dùng:
       *
       * JSON -> online.
       */
      const word =
        findBotNextWord(
          game.currentWord,
          game.usedWords,
        );

      if (!word) {
        return {
          ok: false,
          reason: 'no_word',
          used,

          remaining:
            WORD_CHAIN_HINT_LIMIT -
            used,

          word: null,
          config: current,
        };
      }

      const hintUses = {
        ...(game.hintUses || {}),

        [userId]:
          used + 1,
      };

      current.games[
        resolvedMode
      ] = {
        ...game,
        hintUses,
      };

      const updated =
        await saveWordChainConfig(
          client,
          guildId,
          current,
        );

      return {
        ok: true,
        reason: null,

        used:
          used + 1,

        remaining:
          WORD_CHAIN_HINT_LIMIT -
          used -
          1,

        word,
        config: updated,
      };
    },
  );
}

function getUserStats(
  leaderboard,
  userId,
) {
  const existing =
    leaderboard?.[
      userId
    ];

  if (
    existing &&
    typeof existing === 'object' &&
    !Array.isArray(existing)
  ) {
    return {
      correct:
        toNonNegativeNumber(
          existing.correct,
        ),

      wrong:
        toNonNegativeNumber(
          existing.wrong,
        ),

      bestStreak:
        toNonNegativeNumber(
          existing.bestStreak,
        ),
    };
  }

  return {
    correct:
      toNonNegativeNumber(
        existing,
      ),

    wrong: 0,
    bestStreak: 0,
  };
}

export async function recordUserSuccess(
  client,
  guildId,
  userId,
  word,
  mode = 'bot',
) {
  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  return withStateLock(
    guildId,
    resolvedMode,
    async () => {
      const current =
        await getWordChainConfig(
          client,
          guildId,
        );

      const game =
        getWordChainGame(
          current,
          resolvedMode,
        );

      const normalized =
        normalizeWord(word);

      /**
       * Từ online đã được register vào
       * validWordsSet trước khi hàm này chạy.
       *
       * Vì vậy isValidWord() vẫn hoạt động
       * bình thường ở đây.
       */
      if (
        !game.enabled ||
        !isValidWord(normalized) ||
        (
          game.currentWord &&
          !canChain(
            game.currentWord,
            normalized,
          )
        ) ||
        game.usedWords.includes(
          normalized,
        ) ||
        (
          resolvedMode === 'pvp' &&
          game.lastUserId === userId
        )
      ) {
        return {
          ...current,

          __wordChainAccepted:
            false,
        };
      }

      const leaderboard = {
        bot: {
          ...(current.leaderboard
            ?.bot || {}),
        },

        pvp: {
          ...(current.leaderboard
            ?.pvp || {}),
        },
      };

      const stats =
        getUserStats(
          leaderboard[
            resolvedMode
          ],
          userId,
        );

      stats.correct += 1;

      const personalStreaks =
        normalizePersonalStreaks(
          game.personalStreaks,
        );

      let nextStreak;

      if (
        resolvedMode === 'bot'
      ) {
        nextStreak =
          toNonNegativeNumber(
            personalStreaks[
              userId
            ],
          ) + 1;

        personalStreaks[
          userId
        ] =
          nextStreak;

        stats.bestStreak =
          Math.max(
            stats.bestStreak,
            nextStreak,
          );
      } else {
        nextStreak =
          game.currentStreak +
          1;
      }

      leaderboard[
        resolvedMode
      ][userId] =
        stats;

      current.games[
        resolvedMode
      ] = {
        ...game,

        currentWord:
          normalized,

        lastUserId:
          userId,

        usedWords: [
          ...game.usedWords,
          normalized,
        ],

        currentStreak:
          nextStreak,

        bestStreak:
          Math.max(
            game.bestStreak,
            nextStreak,
          ),

        personalStreaks,

        hintUses:
          game.hintUses || {},
      };

      current.leaderboard =
        leaderboard;

      current.enabled =
        Boolean(
          current.games.pvp
            .enabled ||
          current.games.bot
            .enabled,
        );

      const saved =
        await saveWordChainConfig(
          client,
          guildId,
          current,
        );

      return {
        ...saved,

        __wordChainAccepted:
          true,
      };
    },
  );
}

export async function recordUserFailure(
  client,
  guildId,
  userId,
  mode = 'bot',
) {
  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  return withStateLock(
    guildId,
    resolvedMode,
    async () => {
      const current =
        await getWordChainConfig(
          client,
          guildId,
        );

      const leaderboard = {
        bot: {
          ...(current.leaderboard
            ?.bot || {}),
        },

        pvp: {
          ...(current.leaderboard
            ?.pvp || {}),
        },
      };

      const stats =
        getUserStats(
          leaderboard[
            resolvedMode
          ],
          userId,
        );

      stats.wrong += 1;

      leaderboard[
        resolvedMode
      ][userId] =
        stats;

      current.leaderboard =
        leaderboard;

      current.enabled =
        Boolean(
          current.games.pvp
            .enabled ||
          current.games.bot
            .enabled,
        );

      return saveWordChainConfig(
        client,
        guildId,
        current,
      );
    },
  );
}

export async function recordBotSuccess(
  client,
  guildId,
  botWord,
  mode = 'bot',
) {
  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  return withStateLock(
    guildId,
    resolvedMode,
    async () => {
      const current =
        await getWordChainConfig(
          client,
          guildId,
        );

      const game =
        getWordChainGame(
          current,
          resolvedMode,
        );

      const normalized =
        normalizeWord(botWord);

      if (
        !game.enabled ||
        !isValidWord(normalized) ||
        (
          game.currentWord &&
          !canChain(
            game.currentWord,
            normalized,
          )
        ) ||
        game.usedWords.includes(
          normalized,
        )
      ) {
        return current;
      }

      current.games[
        resolvedMode
      ] = {
        ...game,

        currentWord:
          normalized,

        usedWords: [
          ...game.usedWords,
          normalized,
        ],

        lastUserId:
          game.lastUserId,
      };

      current.enabled =
        Boolean(
          current.games.pvp
            .enabled ||
          current.games.bot
            .enabled,
        );

      return saveWordChainConfig(
        client,
        guildId,
        current,
      );
    },
  );
}

export async function recordBreak(
  client,
  guildId,
  newStartWord = null,
  mode = 'bot',
) {
  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  return withStateLock(
    guildId,
    resolvedMode,
    async () => {
      ensureDictionaryLoaded();

      const current =
        await getWordChainConfig(
          client,
          guildId,
        );

      const game =
        getWordChainGame(
          current,
          resolvedMode,
        );

      const initialWord =
        chooseStartWord(
          newStartWord,
          game.currentWord
            ? [
                game.currentWord,
              ]
            : [],
        );

      current.games[
        resolvedMode
      ] = {
        ...game,

        enabled:
          game.enabled,

        channelId:
          WORD_CHAIN_CHANNELS[
            resolvedMode
          ],

        mode:
          resolvedMode,

        currentWord:
          initialWord,

        lastUserId:
          null,

        usedWords:
          initialWord
            ? [initialWord]
            : [],

        currentStreak:
          0,

        bestStreak:
          game.bestStreak,

        personalStreaks:
          {},

        hintUses:
          {},
      };

      current.enabled =
        Boolean(
          current.games.pvp
            .enabled ||
          current.games.bot
            .enabled,
        );

      return saveWordChainConfig(
        client,
        guildId,
        current,
      );
    },
  );
}

export function buildWordChainLeaderboard(
  config,
  mode = 'bot',
) {
  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  const leaderboard =
    config?.leaderboard?.[
      resolvedMode
    ] || {};

  return Object.entries(
    leaderboard,
  )
    .map(
      ([userId]) => {
        const stats =
          getUserStats(
            leaderboard,
            userId,
          );

        if (
          resolvedMode === 'bot'
        ) {
          return {
            userId,

            score:
              stats.bestStreak,

            bestStreak:
              stats.bestStreak,

            correct:
              stats.correct,

            wrong:
              stats.wrong,
          };
        }

        return {
          userId,

          score:
            stats.correct,

          correct:
            stats.correct,

          wrong:
            stats.wrong,

          bestStreak:
            stats.bestStreak,
        };
      },
    )
    .filter(
      entry =>
        resolvedMode === 'bot'
          ? entry.bestStreak >
              0 ||
            entry.correct >
              0 ||
            entry.wrong >
              0
          : entry.correct >
              0 ||
            entry.wrong >
              0,
    )
    .sort(
      (a, b) => {
        if (
          b.score !==
          a.score
        ) {
          return (
            b.score -
            a.score
          );
        }

        if (
          b.correct !==
          a.correct
        ) {
          return (
            b.correct -
            a.correct
          );
        }

        return (
          a.wrong -
          b.wrong
        );
      },
    );
}

// =========================================================================
// KHÓA NGHỈ BAN ĐÊM (00:00 - 08:00 SÁNG GIỜ VIỆT NAM)
// =========================================================================

const NIGHT_LOCK_NOTICE_COOLDOWN_MS = 60 * 1000;
const announcedNightLockDates = new Map();
const channelNightLockNoticeAt = new Map();

export function resetWordChainNightLockState() {
  announcedNightLockDates.clear();
  channelNightLockNoticeAt.clear();
}

export function getWordChainNow(client = null, overrideNow = undefined) {
  if (typeof overrideNow === 'number' && Number.isFinite(overrideNow)) {
    return overrideNow;
  }
  if (typeof client?._wordChainNow === 'function') {
    const mocked = client._wordChainNow();
    if (typeof mocked === 'number' && Number.isFinite(mocked)) {
      return mocked;
    }
  }
  return Date.now();
}

export function getVietnamTimeParts(nowMs = Date.now()) {
  const date = new Date(nowMs);
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: WORD_CHAIN_NIGHT_LOCK.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const pickInt = (type) => Number.parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
    const pickStr = (type) => parts.find((p) => p.type === type)?.value || '00';
    return {
      year: pickStr('year'),
      month: pickStr('month'),
      day: pickStr('day'),
      dateKey: `${pickStr('year')}-${pickStr('month')}-${pickStr('day')}`,
      hour: pickInt('hour') % 24,
      minute: pickInt('minute'),
      second: pickInt('second'),
    };
  } catch {
    const vnDate = new Date(nowMs + 7 * 60 * 60 * 1000);
    const year = String(vnDate.getUTCFullYear());
    const month = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(vnDate.getUTCDate()).padStart(2, '0');
    return {
      year,
      month,
      day,
      dateKey: `${year}-${month}-${day}`,
      hour: vnDate.getUTCHours(),
      minute: vnDate.getUTCMinutes(),
      second: vnDate.getUTCSeconds(),
    };
  }
}

export function isWordChainNightLock(nowMs = Date.now()) {
  const { hour, minute, second, dateKey } = getVietnamTimeParts(nowMs);
  const startHour = WORD_CHAIN_NIGHT_LOCK.START_HOUR;
  const endHour = WORD_CHAIN_NIGHT_LOCK.END_HOUR;
  const locked = hour >= startHour && hour < endHour;
  return {
    locked,
    hour,
    minute,
    second,
    dateKey,
    startHour,
    endHour,
    currentTimeText: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

export function formatWordChainNightTitle(title) {
  const upperTitle = String(title || '').trim().toUpperCase();
  return `${WORD_CHAIN_NIGHT_EMOJIS.TITLE_LEFT} **${upperTitle}** ${WORD_CHAIN_NIGHT_EMOJIS.TITLE_RIGHT}`;
}

export function buildWordChainNightLockPayloadV2({
  currentTimeText = null,
  startHour = WORD_CHAIN_NIGHT_LOCK.START_HOUR,
  endHour = WORD_CHAIN_NIGHT_LOCK.END_HOUR,
  ephemeral = false,
  configSavedNotice = false,
} = {}) {
  const startLabel = `${String(startHour).padStart(2, '0')}:00`;
  const endLabel = `${String(endHour).padStart(2, '0')}:00`;
  const timeInfo = currentTimeText
    ? `Hiện đang là **${currentTimeText}** — nối từ tạm nghỉ ban đêm để tiết kiệm RAM.`
    : 'Nối từ đang tạm nghỉ ban đêm để tiết kiệm RAM.';
  const footerLine = configSavedNotice
    ? `Đã lưu cấu hình nối từ • Sẽ tự mở lại sau ${endLabel} sáng (chuỗi & BXH vẫn bảo lưu)`
    : `Từ hiện tại, chuỗi Streak & BXH vẫn bảo lưu nguyên vẹn • Mở lại lúc ${endLabel} sáng`;

  const children = [
    {
      type: 10,
      content: formatWordChainNightTitle('NỐI TỪ ĐANG NGHỈ BAN ĐÊM'),
    },
    {
      type: 14,
      divider: true,
      spacing: 1,
    },
    {
      type: 10,
      content: [
        `${WORD_CHAIN_NIGHT_EMOJIS.TIME} **Khung giờ nghỉ nối từ:** **${startLabel} - ${endLabel} sáng** (giờ Việt Nam)`,
        `${WORD_CHAIN_NIGHT_EMOJIS.ADMIN_DISABLE} **Trạng thái:** ${timeInfo}`,
        `${WORD_CHAIN_NIGHT_EMOJIS.NOTEBOOK} **Gợi ý:** Thành viên vẫn có thể gõ **/noitu leaderboard** để xem BXH hoặc quay lại chơi sau **${endLabel} sáng** nha~`,
      ].join('\n'),
    },
    {
      type: 14,
      divider: true,
      spacing: 1,
    },
    {
      type: 10,
      content: `-# ${footerLine}`,
    },
  ];

  return {
    flags: ephemeral ? (MessageFlags.Ephemeral | IS_COMPONENTS_V2) : IS_COMPONENTS_V2,
    allowedMentions: { parse: [] },
    components: [
      {
        type: 17,
        components: children,
      },
    ],
  };
}

export function tryConsumeNightLockNoticeCooldown(
  channelId,
  nowMs = Date.now(),
  cooldownMs = NIGHT_LOCK_NOTICE_COOLDOWN_MS,
) {
  if (!channelId) {
    return false;
  }
  const key = String(channelId);
  const lastAt = channelNightLockNoticeAt.get(key) || 0;
  if (nowMs - lastAt < cooldownMs) {
    return false;
  }
  channelNightLockNoticeAt.set(key, nowMs);
  return true;
}

function hasBotChannelSendPermission(channel, guild) {
  const botMember = guild?.members?.me || channel?.guild?.members?.me;
  if (!botMember || typeof channel?.permissionsFor !== 'function') {
    return true;
  }
  const perms = channel.permissionsFor(botMember);
  return Boolean(
    perms?.has?.(PermissionFlagsBits.ViewChannel) &&
      perms?.has?.(PermissionFlagsBits.SendMessages),
  );
}

async function resolveWordChainChannel(client, guild, channelId) {
  if (!channelId) {
    return null;
  }
  let channel = guild?.channels?.cache?.get?.(channelId) || null;
  if (!channel && typeof guild?.channels?.fetch === 'function') {
    channel = await guild.channels.fetch(channelId).catch(() => null);
  }
  if (!channel && typeof client?.channels?.cache?.get === 'function') {
    channel = client.channels.cache.get(channelId) || null;
  }
  if (!channel && typeof client?.channels?.fetch === 'function') {
    channel = await client.channels.fetch(channelId).catch(() => null);
  }
  return channel;
}

export async function announceWordChainNightLock(client, options = {}) {
  const { force = false } = options;
  const nowMs = getWordChainNow(client, options.now);
  const nightStatus = isWordChainNightLock(nowMs);

  unloadDictionary('night_lock');

  if (!nightStatus.locked && !force) {
    return { announcedChannels: 0, skippedGuilds: 0, errors: 0 };
  }

  const guilds = client?.guilds?.cache ? Array.from(client.guilds.cache.values()) : [];
  let announcedChannels = 0;
  let skippedGuilds = 0;
  let errors = 0;

  const payload = buildWordChainNightLockPayloadV2({
    currentTimeText: nightStatus.currentTimeText,
    startHour: nightStatus.startHour,
    endHour: nightStatus.endHour,
    ephemeral: false,
  });

  for (const guild of guilds) {
    try {
      const config = await getWordChainConfig(client, guild.id);
      if (!config?.enabled) {
        skippedGuilds += 1;
        continue;
      }

      const targetChannelIds = new Set();
      for (const mode of ['pvp', 'bot']) {
        const game = getWordChainGame(config, mode);
        if (game.enabled) {
          const chId = game.channelId || WORD_CHAIN_CHANNELS[mode];
          if (chId) {
            targetChannelIds.add(String(chId));
          }
        }
      }

      if (targetChannelIds.size === 0) {
        skippedGuilds += 1;
        continue;
      }

      for (const channelId of targetChannelIds) {
        const announcementKey = `${guild.id}:${channelId}`;
        if (!force && announcedNightLockDates.get(announcementKey) === nightStatus.dateKey) {
          continue;
        }

        const channel = await resolveWordChainChannel(client, guild, channelId);
        if (!channel || typeof channel.send !== 'function') {
          continue;
        }
        if (!hasBotChannelSendPermission(channel, guild)) {
          continue;
        }

        await channel.send(payload);
        announcedNightLockDates.set(announcementKey, nightStatus.dateKey);
        channelNightLockNoticeAt.set(channelId, nowMs);
        announcedChannels += 1;
      }
    } catch (error) {
      errors += 1;
      logger.warn(`[WordChain] Lỗi thông báo khóa ban đêm cho guild ${guild?.id}:`, error?.message || error);
    }
  }

  logger.info(
    `[WordChain] Thông báo khóa ban đêm 00:00 (${nightStatus.currentTimeText} VN): đã gửi ${announcedChannels} kênh, bỏ qua ${skippedGuilds} server, lỗi ${errors}.`,
  );

  return { announcedChannels, skippedGuilds, errors };
}
