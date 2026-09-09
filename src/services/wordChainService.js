import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { logger } from '../utils/logger.js';

import {
  isOnlineWordValid,
  findOnlineNextWord,
} from './wordChainOnlineDictionary.js';

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

export function normalizeWord(word) {
  if (typeof word !== 'string') {
    return '';
  }

  return word
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function initDictionary() {
  if (dictionaryLoaded) {
    return true;
  }

  try {
    const dictPath = path.join(
      __dirname,
      '../data/vietnamese_words.json',
    );

    if (!fs.existsSync(dictPath)) {
      logger.warn(
        `Vietnamese dictionary file not found at ${dictPath}`,
      );

      return false;
    }

    const rawData = fs.readFileSync(
      dictPath,
      'utf8',
    );

    const words = JSON.parse(rawData);

    if (!Array.isArray(words)) {
      logger.error(
        'Vietnamese dictionary must be an array.',
      );

      return false;
    }

    const nextValidWords = new Set();
    const nextStartWordMap = new Map();

    for (const word of words) {
      const cleaned = normalizeWord(word);

      if (!cleaned) {
        continue;
      }

      const parts = cleaned.split(' ');

      if (parts.length !== 2) {
        continue;
      }

      if (
        !parts.every(
          part =>
            /^\p{L}+$/u.test(part),
        )
      ) {
        continue;
      }

      nextValidWords.add(cleaned);

      const first = parts[0];

      if (!nextStartWordMap.has(first)) {
        nextStartWordMap.set(first, []);
      }

      nextStartWordMap
        .get(first)
        .push(cleaned);
    }

    validWordsSet = nextValidWords;
    startWordMap = nextStartWordMap;
    dictionaryLoaded = true;

    logger.info(
      `Loaded ${validWordsSet.size} Vietnamese words for Word Chain minigame.`,
    );

    return true;
  } catch (error) {
    logger.error(
      'Error loading Vietnamese dictionary:',
      error,
    );

    return false;
  }
}

initDictionary();

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
  initDictionary();

  const cleaned =
    normalizeWord(word);

  if (!cleaned) {
    return false;
  }

  const parts =
    cleaned.split(' ');

  if (parts.length !== 2) {
    return false;
  }

  if (
    !parts.every(
      part =>
        /^\p{L}+$/u.test(part),
    )
  ) {
    return false;
  }

  return validWordsSet.has(
    cleaned,
  );
}

/**
 * Từ được tìm thấy online sẽ được
 * thêm vào dictionary runtime.
 *
 * Không sửa file JSON trên GitHub.
 * Chỉ tồn tại trong RAM của bot cho
 * đến khi bot restart.
 */
function registerRuntimeWord(word) {
  const cleaned =
    normalizeWord(word);

  const parts =
    cleaned
      .split(' ')
      .filter(Boolean);

  if (
    parts.length !== 2 ||
    !parts.every(
      part =>
        /^\p{L}+$/u.test(part),
    )
  ) {
    return false;
  }

  validWordsSet.add(cleaned);

  const first =
    parts[0];

  if (!startWordMap.has(first)) {
    startWordMap.set(
      first,
      [],
    );
  }

  const list =
    startWordMap.get(first);

  if (!list.includes(cleaned)) {
    list.push(cleaned);
  }

  return true;
}

/**
 * =========================================================
 * LOCAL JSON -> ONLINE FALLBACK
 * =========================================================
 *
 * Đây là hàm messageCreate/noitu nên dùng
 * thay cho isValidWord() khi kiểm tra từ
 * do người chơi nhập.
 */
export async function isValidWordWithFallback(
  client,
  word,
) {
  const cleaned =
    normalizeWord(word);

  if (isValidWord(cleaned)) {
    return true;
  }

  const onlineValid =
    await isOnlineWordValid(
      client,
      cleaned,
    );

  if (onlineValid) {
    registerRuntimeWord(
      cleaned,
    );
  }

  return onlineValid;
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
  initDictionary();

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

/**
 * =========================================================
 * BOT LOCAL -> ONLINE FALLBACK
 * =========================================================
 *
 * Bot ưu tiên JSON.
 *
 * Chỉ khi JSON không tìm được từ nối
 * thì mới gọi nguồn online.
 */
export async function findBotNextWordWithFallback(
  client,
  prevWord,
  usedWords = [],
) {
  const localWord =
    findBotNextWord(
      prevWord,
      usedWords,
    );

  if (localWord) {
    return localWord;
  }

  const onlineWord =
    await findOnlineNextWord(
      client,
      prevWord,
      usedWords,
    );

  if (onlineWord) {
    registerRuntimeWord(
      onlineWord,
    );
  }

  return onlineWord;
}

export function getRandomStartWord(
  excludeWords = [],
) {
  initDictionary();

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

  return 'học sinh';
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
      initDictionary();

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
      initDictionary();

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
        await findBotNextWordWithFallback(
          client,
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
      initDictionary();

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
