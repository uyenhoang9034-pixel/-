import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * =========================================================
 * WORD CHAIN FIXED CHANNELS
 * =========================================================
 */

export const WORD_CHAIN_CHANNELS = {
  pvp: '1545291672504508416',
  bot: '1546428675367505920',
};

/**
 * =========================================================
 * WORD CHAIN CONSTANTS
 * =========================================================
 */

export const WORD_CHAIN_HINT_LIMIT = 3;

const WORD_CHAIN_KEY_PREFIX = 'wordChain:';

let validWordsSet = new Set();
let startWordMap = new Map();
let isDictionaryLoaded = false;

/**
 * =========================================================
 * DICTIONARY
 * =========================================================
 */

export function initDictionary() {
  if (isDictionaryLoaded) {
    return;
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

      return;
    }

    const rawData =
      fs.readFileSync(
        dictPath,
        'utf8',
      );

    const words =
      JSON.parse(rawData);

    validWordsSet = new Set();
    startWordMap = new Map();

    for (const word of words) {
      const cleaned =
        String(word)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ');

      if (!cleaned) {
        continue;
      }

      validWordsSet.add(cleaned);

      const parts =
        cleaned.split(' ');

      if (parts.length !== 2) {
        continue;
      }

      const first =
        parts[0];

      if (!startWordMap.has(first)) {
        startWordMap.set(
          first,
          [],
        );
      }

      startWordMap
        .get(first)
        .push(cleaned);
    }

    isDictionaryLoaded = true;

    logger.info(
      `Loaded ${validWordsSet.size} Vietnamese words for Word Chain minigame.`,
    );
  } catch (error) {
    logger.error(
      'Error loading Vietnamese dictionary:',
      error,
    );
  }
}

initDictionary();

/**
 * =========================================================
 * MODES
 * =========================================================
 */

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

/**
 * =========================================================
 * DEFAULT GAME STATE
 * =========================================================
 */

function createDefaultGame(
  mode,
) {
  return {
    enabled: false,

    channelId:
      WORD_CHAIN_CHANNELS[
        mode
      ] || null,

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

/**
 * =========================================================
 * DEFAULT CONFIG
 * =========================================================
 */

const DEFAULT_WORD_CHAIN_CONFIG = {
  enabled: false,

  channelId: null,

  mode: 'bot',

  /**
   * Hai game chạy độc lập.
   */
  games: {
    pvp:
      createDefaultGame('pvp'),

    bot:
      createDefaultGame('bot'),
  },

  /**
   * Leaderboard vẫn tách riêng
   * PvE / PvP.
   */
  leaderboard: {
    bot: {},
    pvp: {},
  },
};

/**
 * =========================================================
 * MODE RESOLUTION
 * =========================================================
 */

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

/**
 * =========================================================
 * NORMALIZE LEADERBOARD
 * =========================================================
 */

function normalizeLeaderboardMode(
  leaderboard,
) {
  if (
    !leaderboard ||
    typeof leaderboard !== 'object'
  ) {
    return {};
  }

  const normalized = {};

  for (
    const [userId, value]
    of Object.entries(
      leaderboard,
    )
  ) {
    if (
      value &&
      typeof value === 'object'
    ) {
      normalized[userId] = {
        correct:
          Math.max(
            0,
            Number(
              value.correct || 0,
            ),
          ),

        wrong:
          Math.max(
            0,
            Number(
              value.wrong || 0,
            ),
          ),
      };

      continue;
    }

    /**
     * Migration dữ liệu cũ:
     *
     * userId: 100
     *
     * =>
     *
     * {
     *   correct: 100,
     *   wrong: 0
     * }
     */

    normalized[userId] = {
      correct:
        Math.max(
          0,
          Number(
            value || 0,
          ),
        ),

      wrong: 0,
    };
  }

  return normalized;
}

/**
 * =========================================================
 * NORMALIZE PERSONAL STREAK
 * =========================================================
 */

function normalizePersonalStreaks(
  personalStreaks,
) {
  if (
    !personalStreaks ||
    typeof personalStreaks !== 'object'
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(
      personalStreaks,
    ).map(
      ([userId, value]) => [
        userId,
        Math.max(
          0,
          Number(
            value || 0,
          ),
        ),
      ],
    ),
  );
}

/**
 * =========================================================
 * NORMALIZE HINT USES
 * =========================================================
 */

function normalizeHintUses(
  hintUses,
) {
  if (
    !hintUses ||
    typeof hintUses !== 'object'
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(
      hintUses,
    ).map(
      ([userId, value]) => [
        userId,
        Math.max(
          0,
          Math.min(
            WORD_CHAIN_HINT_LIMIT,
            Number(
              value || 0,
            ),
          ),
        ),
      ],
    ),
  );
}

/**
 * =========================================================
 * NORMALIZE GAME
 * =========================================================
 */

function normalizeGame(
  rawGame,
  mode,
) {
  const defaults =
    createDefaultGame(
      mode,
    );

  const game = {
    ...defaults,
    ...(rawGame || {}),
  };

  game.mode = mode;

  game.channelId =
    WORD_CHAIN_CHANNELS[
      mode
    ];

  game.enabled =
    Boolean(
      game.enabled,
    );

  game.currentWord =
    game.currentWord
      ? normalizeWord(
          game.currentWord,
        )
      : null;

  game.lastUserId =
    game.lastUserId ||
    null;

  game.usedWords =
    Array.isArray(
      game.usedWords,
    )
      ? game.usedWords
          .map(
            (word) =>
              normalizeWord(
                word,
              ),
          )
          .filter(Boolean)
      : [];

  game.currentStreak =
    Math.max(
      0,
      Number(
        game.currentStreak || 0,
      ),
    );

  game.bestStreak =
    Math.max(
      0,
      Number(
        game.bestStreak || 0,
      ),
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

/**
 =========================================================
 * NORMALIZE CONFIG + OLD DATA MIGRATION
 * =========================================================
 */

function normalizeWordChainConfig(
  state,
) {
  const raw =
    state &&
    typeof state === 'object'
      ? state
      : {};

  const rawLeaderboard =
    raw.leaderboard &&
    typeof raw.leaderboard === 'object'
      ? raw.leaderboard
      : {};

  let leaderboard;

  if (
    rawLeaderboard.bot ||
    rawLeaderboard.pvp
  ) {
    leaderboard = {
      bot:
        normalizeLeaderboardMode(
          rawLeaderboard.bot,
        ),

      pvp:
        normalizeLeaderboardMode(
          rawLeaderboard.pvp,
        ),
    };
  } else {
    /**
     * Dữ liệu cũ chỉ có một leaderboard.
     *
     * Giữ lại ở PvE để không mất dữ liệu.
     */
    leaderboard = {
      bot:
        normalizeLeaderboardMode(
          rawLeaderboard,
        ),

      pvp: {},
    };
  }

  let games;

  /**
   * =======================================================
   * DỮ LIỆU MỚI
   * =======================================================
   */

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
    /**
     * =====================================================
     * MIGRATION DỮ LIỆU CŨ
     * =====================================================
     *
     * Config cũ:
     *
     * {
     *   channelId,
     *   mode,
     *   currentWord,
     *   ...
     * }
     *
     * Chuyển toàn bộ game cũ
     * sang mode tương ứng.
     */

    const oldMode =
      raw.mode === 'pvp'
        ? 'pvp'
        : 'bot';

    const oldGame =
      normalizeGame(
        {
          enabled:
            Boolean(
              raw.enabled,
            ),

          channelId:
            raw.channelId,

          mode:
            oldMode,

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
            ] ||
            raw.personalStreaks,

          hintUses:
            raw.hintUses?.[
              oldMode
            ] ||
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
      oldGame;
  }

  const normalized = {
    ...DEFAULT_WORD_CHAIN_CONFIG,
    ...raw,

    enabled:
      Boolean(
        games.pvp.enabled ||
        games.bot.enabled,
      ),

    games,

    leaderboard,
  };

  /**
   * Legacy fields giữ lại
   * để các module cũ không crash.
   *
   * Nhưng hệ thống mới không dùng
   * chúng để xử lý game.
   */

  normalized.channelId =
    normalized.channelId ||
    null;

  normalized.mode =
    normalized.mode === 'pvp'
      ? 'pvp'
      : 'bot';

  return normalized;
}

/**
 * =========================================================
 * STORAGE
 * =========================================================
 */

function getStorageKey(
  guildId,
) {
  return `${WORD_CHAIN_KEY_PREFIX}${guildId}`;
}

export async function getWordChainConfig(
  client,
  guildId,
) {
  try {
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

  await client.db.set(
    getStorageKey(guildId),
    normalized,
  );

  return normalized;
}

/**
 * =========================================================
 * GET GAME
 * =========================================================
 */

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

/**
 * =========================================================
 * ACTIVATE / SETUP MODE
 * =========================================================
 */

export async function activateWordChain(
  client,
  guildId,
  channelId,
  mode = 'bot',
  startWord = null,
) {
  initDictionary();

  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  const fixedChannel =
    WORD_CHAIN_CHANNELS[
      resolvedMode
    ];

  const current =
    await getWordChainConfig(
      client,
      guildId,
    );

  const normalizedStart =
    startWord
      ? normalizeWord(
          startWord,
        )
      : null;

  const initialWord =
    normalizedStart &&
    isValidWord(
      normalizedStart,
    )
      ? normalizedStart
      : getRandomStartWord();

  current.games[
    resolvedMode
  ] = {
    ...createDefaultGame(
      resolvedMode,
    ),

    enabled: true,

    channelId:
      fixedChannel,

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

    currentStreak: 0,

    bestStreak:
      Number(
        current.games?.[
          resolvedMode
        ]?.bestStreak || 0,
      ),

    personalStreaks: {},

    hintUses: {},
  };

  current.enabled = true;

  current.mode =
    resolvedMode;

  current.channelId =
    fixedChannel;

  return saveWordChainConfig(
    client,
    guildId,
    current,
  );
}

/**
 * =========================================================
 * DISABLE ALL
 * =========================================================
 */

export async function disableWordChain(
  client,
  guildId,
) {
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
}

/**
 * =========================================================
 * DISABLE ONE MODE
 * =========================================================
 */

export async function disableWordChainMode(
  client,
  guildId,
  mode,
) {
  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  const current =
    await getWordChainConfig(
      client,
      guildId,
    );

  current.games[
    resolvedMode
  ].enabled = false;

  current.enabled =
    Boolean(
      current.games.pvp.enabled ||
      current.games.bot.enabled,
    );

  return saveWordChainConfig(
    client,
    guildId,
    current,
  );
}

/**
 * =========================================================
 * RESET ONE MODE
 * =========================================================
 */

export async function resetWordChainGame(
  client,
  guildId,
  startWord = null,
  mode = 'bot',
) {
  initDictionary();

  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

  const current =
    await getWordChainConfig(
      client,
      guildId,
    );

  const normalizedStart =
    startWord
      ? normalizeWord(
          startWord,
        )
      : null;

  const initialWord =
    normalizedStart &&
    isValidWord(
      normalizedStart,
    )
      ? normalizedStart
      : getRandomStartWord();

  const existingGame =
    current.games[
      resolvedMode
    ] ||
    createDefaultGame(
      resolvedMode,
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

    personalStreaks: {},

    hintUses: {},
  };

  current.enabled =
    Boolean(
      current.games.pvp.enabled ||
      current.games.bot.enabled,
    );

  return saveWordChainConfig(
    client,
    guildId,
    current,
  );
}

/**
 * =========================================================
 * NORMALIZE WORD
 * =========================================================
 */

export function normalizeWord(
  word,
) {
  if (
    typeof word !== 'string'
  ) {
    return '';
  }

  return word
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * =========================================================
 * VALID WORD
 * =========================================================
 */

export function isValidWord(
  word,
) {
  initDictionary();

  const cleaned =
    normalizeWord(word);

  if (!cleaned) {
    return false;
  }

  const parts =
    cleaned.split(' ');

  if (
    parts.length !== 2
  ) {
    return false;
  }

  if (
    !parts.every(
      (part) =>
        /^\p{L}+$/u.test(
          part,
        ),
    )
  ) {
    return false;
  }

  return validWordsSet.has(
    cleaned,
  );
}

/**
 * =========================================================
 * CAN CHAIN
 * =========================================================
 */

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

  const prevParts =
    normalizeWord(
      prevWord,
    ).split(' ');

  const nextParts =
    normalizeWord(
      nextWord,
    ).split(' ');

  if (
    prevParts.length !== 2 ||
    nextParts.length !== 2
  ) {
    return false;
  }

  return (
    prevParts[1] ===
    nextParts[0]
  );
}

/**
 * =========================================================
 * LAST SYLLABLE
 * =========================================================
 */

export function getLastSyllable(
  word,
) {
  if (!word) {
    return '';
  }

  const parts =
    normalizeWord(
      word,
    ).split(' ');

  return parts.length === 2
    ? parts[1]
    : '';
}

/**
 * =========================================================
 * FIRST SYLLABLE
 * =========================================================
 */

export function getFirstSyllable(
  word,
) {
  if (!word) {
    return '';
  }

  const parts =
    normalizeWord(
      word,
    ).split(' ');

  return parts.length === 2
    ? parts[0]
    : '';
}

/**
 * =========================================================
 * FIND NEXT WORD
 * =========================================================
 */

export function findBotNextWord(
  prevWord,
  usedWords = [],
) {
  initDictionary();

  const lastSyllable =
    getLastSyllable(
      prevWord,
    );

  if (!lastSyllable) {
    return null;
  }

  const candidates =
    startWordMap.get(
      lastSyllable,
    );

  if (
    !candidates ||
    candidates.length === 0
  ) {
    return null;
  }

  const usedSet =
    new Set(
      usedWords.map(
        (word) =>
          normalizeWord(
            word,
          ),
      ),
    );

  const availableCandidates =
    candidates.filter(
      (word) =>
        !usedSet.has(word),
    );

  if (
    availableCandidates.length === 0
  ) {
    return null;
  }

  const randomIndex =
    Math.floor(
      Math.random() *
        availableCandidates.length,
    );

  return availableCandidates[
    randomIndex
  ];
}

/**
 * =========================================================
 * RANDOM START WORD
 * =========================================================
 */

export function getRandomStartWord() {
  initDictionary();

  const safeStartWords = [
    'học sinh',
    'hoa hồng',
    'bình minh',
    'mặt trời',
    'thời gian',
    'con cá',
    'nước biển',
    'bầu trời',
    'tương lai',
    'thành phố',
    'gia đình',
    'cuộc sống',
    'yêu thương',
    'bạn bè',
    'ngôi sao',
  ];

  const validStarters =
    safeStartWords.filter(
      (word) =>
        validWordsSet.has(
          word,
        ),
    );

  if (
    validStarters.length > 0
  ) {
    return validStarters[
      Math.floor(
        Math.random() *
          validStarters.length,
      )
    ];
  }

  const allWords =
    Array.from(
      validWordsSet,
    );

  if (
    allWords.length > 0
  ) {
    return allWords[
      Math.floor(
        Math.random() *
          allWords.length,
      )
    ];
  }

  return 'học sinh';
}

/**
 * =========================================================
 * HINT
 * =========================================================
 */

export async function useWordChainHint(
  client,
  guildId,
  userId,
  mode = 'bot',
) {
  initDictionary();

  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

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

  const used =
    Math.max(
      0,
      Math.min(
        WORD_CHAIN_HINT_LIMIT,
        Number(
          game.hintUses?.[
            userId
          ] || 0,
        ),
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
    };
  }

  const word =
    findBotNextWord(
      game.currentWord,
      game.usedWords || [],
    );

  /**
   * Không có từ:
   *
   * - không trừ lượt gợi ý
   * - caller sẽ kết thúc round
   */

  if (!word) {
    return {
      ok: false,
      reason: 'no_word',
      used,
      remaining:
        WORD_CHAIN_HINT_LIMIT -
        used,
      word: null,
    };
  }

  const hintUses = {
    ...(game.hintUses || {}),
  };

  hintUses[userId] =
    used + 1;

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
      (used + 1),

    word,

    config:
      updated,
  };
}

/**
 * =========================================================
 * RECORD USER SUCCESS
 * =========================================================
 */

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

  const leaderboard = {
    bot: {
      ...(current.leaderboard?.bot || {}),
    },

    pvp: {
      ...(current.leaderboard?.pvp || {}),
    },
  };

  const existingStats =
    leaderboard[
      resolvedMode
    ][userId];

  const stats =
    existingStats &&
    typeof existingStats === 'object'
      ? {
          correct:
            Number(
              existingStats.correct ||
                0,
            ),

          wrong:
            Number(
              existingStats.wrong ||
                0,
            ),
        }
      : {
          correct:
            Number(
              existingStats ||
                0,
            ),

          wrong: 0,
        };

  stats.correct += 1;

  leaderboard[
    resolvedMode
  ][userId] = stats;

  let nextStreak = 0;

  const personalStreaks =
    normalizePersonalStreaks(
      game.personalStreaks,
    );

  if (
    resolvedMode === 'bot'
  ) {
    nextStreak =
      Number(
        personalStreaks[
          userId
        ] || 0,
      ) + 1;

    personalStreaks[
      userId
    ] = nextStreak;
  } else {
    nextStreak =
      Number(
        game.currentStreak ||
          0,
      ) + 1;
  }

  const nextUsedWords = [
    ...(game.usedWords || []),
    normalized,
  ];

  current.games[
    resolvedMode
  ] = {
    ...game,

    currentWord:
      normalized,

    lastUserId:
      userId,

    usedWords:
      nextUsedWords,

    currentStreak:
      nextStreak,

    bestStreak:
      Math.max(
        Number(
          game.bestStreak ||
            0,
        ),
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
      current.games.pvp.enabled ||
      current.games.bot.enabled,
    );

  return saveWordChainConfig(
    client,
    guildId,
    current,
  );
}

/**
 * =========================================================
 * RECORD USER FAILURE
 * =========================================================
 */

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

  const current =
    await getWordChainConfig(
      client,
      guildId,
    );

  const leaderboard = {
    bot: {
      ...(current.leaderboard?.bot || {}),
    },

    pvp: {
      ...(current.leaderboard?.pvp || {}),
    },
  };

  const existingStats =
    leaderboard[
      resolvedMode
    ][userId];

  const stats =
    existingStats &&
    typeof existingStats === 'object'
      ? {
          correct:
            Number(
              existingStats.correct ||
                0,
            ),

          wrong:
            Number(
              existingStats.wrong ||
                0,
            ),
        }
      : {
          correct:
            Number(
              existingStats ||
                0,
            ),

          wrong: 0,
        };

  stats.wrong += 1;

  leaderboard[
    resolvedMode
  ][userId] = stats;

  current.leaderboard =
    leaderboard;

  return saveWordChainConfig(
    client,
    guildId,
    current,
  );
}

/**
 * =========================================================
 * RECORD BOT SUCCESS
 * =========================================================
 */

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
    normalizeWord(
      botWord,
    );

  const nextUsedWords = [
    ...(game.usedWords || []),
    normalized,
  ];

  current.games[
    resolvedMode
  ] = {
    ...game,

    currentWord:
      normalized,

    usedWords:
      nextUsedWords,

    /**
     * Bot không phải player.
     */
    lastUserId:
      game.lastUserId ||
      null,

    currentStreak:
      Number(
        game.currentStreak ||
          0,
      ),
  };

  return saveWordChainConfig(
    client,
    guildId,
    current,
  );
}

/**
 * =========================================================
 * BREAK / END ROUND
 * =========================================================
 */

export async function recordBreak(
  client,
  guildId,
  newStartWord = null,
  mode = 'bot',
) {
  initDictionary();

  const resolvedMode =
    mode === 'pvp'
      ? 'pvp'
      : 'bot';

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

  const normalizedStart =
    newStartWord
      ? normalizeWord(
          newStartWord,
        )
      : null;

  const initialWord =
    normalizedStart &&
    isValidWord(
      normalizedStart,
    )
      ? normalizedStart
      : getRandomStartWord();

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

    personalStreaks: {},

    hintUses: {},
  };

  current.enabled =
    Boolean(
      current.games.pvp.enabled ||
      current.games.bot.enabled,
    );

  return saveWordChainConfig(
    client,
    guildId,
    current,
  );
}

/**
 * =========================================================
 * LEADERBOARD
 * =========================================================
 */

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
      (
        [userId, value],
      ) => {
        if (
          value &&
          typeof value === 'object'
        ) {
          const correct =
            Math.max(
              0,
              Number(
                value.correct ||
                  0,
              ),
            );

          const wrong =
            Math.max(
              0,
              Number(
                value.wrong ||
                  0,
              ),
            );

          return {
            userId,
            score:
              correct,
            correct,
            wrong,
          };
        }

        const correct =
          Math.max(
            0,
            Number(
              value || 0,
            ),
          );

        return {
          userId,
          score:
            correct,
          correct,
          wrong: 0,
        };
      },
    )
    .filter(
      (entry) =>
        entry.correct > 0 ||
        entry.wrong > 0,
    )
    .sort(
      (a, b) =>
        b.correct -
        a.correct,
    );
}
