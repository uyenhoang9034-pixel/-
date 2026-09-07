import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  if (isDictionaryLoaded) return;

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

    const rawData = fs.readFileSync(
      dictPath,
      'utf8',
    );

    const words = JSON.parse(rawData);

    if (!Array.isArray(words)) {
      logger.error(
        'Vietnamese dictionary must contain an array.',
      );
      return;
    }

    validWordsSet = new Set();
    startWordMap = new Map();

    for (const word of words) {
      const cleaned = String(word)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

      if (!cleaned) continue;

      const parts = cleaned.split(' ');

      /**
       * Chỉ đưa từ 2 tiếng vào Word Chain.
       */
      if (parts.length !== 2) {
        continue;
      }

      if (
        !parts.every(
          (part) => /^\p{L}+$/u.test(part),
        )
      ) {
        continue;
      }

      validWordsSet.add(cleaned);

      const first = parts[0];

      if (!startWordMap.has(first)) {
        startWordMap.set(first, []);
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
 * DEFAULT CONFIG
 * =========================================================
 */

const DEFAULT_WORD_CHAIN_CONFIG = {
  enabled: false,

  channelId: null,

  mode: 'bot',

  currentWord: null,

  lastUserId: null,

  usedWords: [],

  currentStreak: 0,

  bestStreak: 0,

  personalStreaks: {
    bot: {},
    pvp: {},
  },

  hintUses: {
    bot: {},
    pvp: {},
  },

  leaderboard: {
    bot: {},
    pvp: {},
  },
};

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
    of Object.entries(leaderboard)
  ) {
    if (
      value &&
      typeof value === 'object'
    ) {
      normalized[userId] = {
        correct: Math.max(
          0,
          Number(value.correct || 0),
        ),

        wrong: Math.max(
          0,
          Number(value.wrong || 0),
        ),
      };

      continue;
    }

    /**
     * Migration dữ liệu cũ:
     *
     * userId: 120
     *
     * =>
     *
     * {
     *   correct: 120,
     *   wrong: 0
     * }
     */

    normalized[userId] = {
      correct: Math.max(
        0,
        Number(value || 0),
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
    return {
      bot: {},
      pvp: {},
    };
  }

  const normalizeMode = (mode) => {
    if (
      !mode ||
      typeof mode !== 'object'
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(mode).map(
        ([userId, value]) => [
          userId,
          Math.max(
            0,
            Number(value || 0),
          ),
        ],
      ),
    );
  };

  return {
    bot: normalizeMode(
      personalStreaks.bot,
    ),

    pvp: normalizeMode(
      personalStreaks.pvp,
    ),
  };
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
    return {
      bot: {},
      pvp: {},
    };
  }

  const normalizeMode = (mode) => {
    if (
      !mode ||
      typeof mode !== 'object'
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(mode).map(
        ([userId, value]) => [
          userId,
          Math.max(
            0,
            Math.min(
              2,
              Number(value || 0),
            ),
          ),
        ],
      ),
    );
  };

  return {
    bot: normalizeMode(
      hintUses.bot,
    ),

    pvp: normalizeMode(
      hintUses.pvp,
    ),
  };
}

/**
 * =========================================================
 * NORMALIZE CONFIG
 * =========================================================
 */

function normalizeWordChainConfig(
  state,
) {
  const normalized = {
    ...DEFAULT_WORD_CHAIN_CONFIG,
    ...(state || {}),
  };

  if (
    !WORD_CHAIN_MODES[
      normalized.mode
    ]
  ) {
    normalized.mode = 'bot';
  }

  normalized.usedWords =
    Array.isArray(
      normalized.usedWords,
    )
      ? normalized.usedWords
          .map((word) =>
            normalizeWord(word),
          )
          .filter(Boolean)
      : [];

  /**
   * =======================================================
   * LEADERBOARD
   * =======================================================
   */

  const rawLeaderboard =
    normalized.leaderboard &&
    typeof normalized.leaderboard === 'object'
      ? normalized.leaderboard
      : {};

  const hasModeLeaderboard =
    rawLeaderboard.bot ||
    rawLeaderboard.pvp;

  if (hasModeLeaderboard) {
    normalized.leaderboard = {
      bot: normalizeLeaderboardMode(
        rawLeaderboard.bot,
      ),

      pvp: normalizeLeaderboardMode(
        rawLeaderboard.pvp,
      ),
    };
  } else {
    normalized.leaderboard = {
      bot: normalizeLeaderboardMode(
        rawLeaderboard,
      ),

      pvp: {},
    };
  }

  /**
   * =======================================================
   * PERSONAL STREAK
   * =======================================================
   */

  normalized.personalStreaks =
    normalizePersonalStreaks(
      normalized.personalStreaks,
    );

  /**
   * =======================================================
   * HINT
   * =======================================================
   */

  normalized.hintUses =
    normalizeHintUses(
      normalized.hintUses,
    );

  normalized.currentStreak =
    Math.max(
      0,
      Number(
        normalized.currentStreak || 0,
      ),
    );

  normalized.bestStreak =
    Math.max(
      0,
      Number(
        normalized.bestStreak || 0,
      ),
    );

  if (
    normalized.currentWord
  ) {
    const normalizedCurrentWord =
      normalizeWord(
        normalized.currentWord,
      );

    normalized.currentWord =
      isValidWord(
        normalizedCurrentWord,
      )
        ? normalizedCurrentWord
        : null;
  }

  if (
    normalized.lastUserId !== null &&
    normalized.lastUserId !== undefined
  ) {
    normalized.lastUserId =
      String(
        normalized.lastUserId,
      );
  }

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
 * ACTIVATE
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

  const current =
    await getWordChainConfig(
      client,
      guildId,
    );

  const normalizedStart =
    startWord
      ? normalizeWord(startWord)
      : null;

  const initialWord =
    normalizedStart &&
    isValidWord(normalizedStart)
      ? normalizedStart
      : getRandomStartWord();

  const nextState = {
    ...current,

    enabled: true,

    channelId,

    mode:
      WORD_CHAIN_MODES[mode]
        ? mode
        : 'bot',

    currentWord:
      initialWord,

    lastUserId:
      null,

    usedWords:
      initialWord
        ? [initialWord]
        : [],

    currentStreak: 0,

    personalStreaks: {
      bot: {},
      pvp: {},
    },

    hintUses: {
      bot: {},
      pvp: {},
    },
  };

  return saveWordChainConfig(
    client,
    guildId,
    nextState,
  );
}

/**
 * =========================================================
 * DISABLE
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

  return saveWordChainConfig(
    client,
    guildId,
    {
      ...current,
      enabled: false,
    },
  );
}

/**
 * =========================================================
 * RESET / RESTART
 * =========================================================
 */

export async function resetWordChainGame(
  client,
  guildId,
  startWord = null,
) {
  initDictionary();

  const current =
    await getWordChainConfig(
      client,
      guildId,
    );

  const normalizedStart =
    startWord
      ? normalizeWord(startWord)
      : null;

  const initialWord =
    normalizedStart &&
    isValidWord(normalizedStart)
      ? normalizedStart
      : getRandomStartWord();

  const nextState = {
    ...current,

    currentWord:
      initialWord,

    lastUserId:
      null,

    usedWords:
      initialWord
        ? [initialWord]
        : [],

    currentStreak: 0,

    personalStreaks: {
      bot: {},
      pvp: {},
    },

    hintUses: {
      bot: {},
      pvp: {},
    },
  };

  return saveWordChainConfig(
    client,
    guildId,
    nextState,
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
 * FIND BOT NEXT WORD
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
      usedWords
        .map((word) =>
          normalizeWord(word),
        )
        .filter(Boolean),
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
        validWordsSet.has(word),
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

  /**
   * Fallback:
   *
   * Chỉ lấy từ trong startWordMap,
   * vì tất cả đều chắc chắn là từ 2 tiếng.
   */

  const allTwoSyllableWords =
    Array.from(
      startWordMap.values(),
    ).flat();

  if (
    allTwoSyllableWords.length > 0
  ) {
    return allTwoSyllableWords[
      Math.floor(
        Math.random() *
          allTwoSyllableWords.length,
      )
    ];
  }

  return 'học sinh';
}

/**
 * =========================================================
 * WORD CHAIN HINT
 * =========================================================
 */

export async function useWordChainHint(
  client,
  guildId,
  userId,
) {
  initDictionary();

  const current =
    await getWordChainConfig(
      client,
      guildId,
    );

  if (!current.enabled) {
    return {
      ok: false,
      reason: 'disabled',
      used: 0,
      remaining: 0,
      word: null,
    };
  }

  const mode =
    current.mode === 'pvp'
      ? 'pvp'
      : 'bot';

  const hintUses = {
    bot: {
      ...(current.hintUses?.bot || {}),
    },

    pvp: {
      ...(current.hintUses?.pvp || {}),
    },
  };

  const used =
    Math.max(
      0,
      Math.min(
        2,
        Number(
          hintUses[mode][userId] || 0,
        ),
      ),
    );

  if (used >= 2) {
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
      current.currentWord,
      current.usedWords || [],
    );

  if (!word) {
    return {
      ok: false,
      reason: 'no_word',
      used,
      remaining:
        2 - used,
      word: null,
    };
  }

  hintUses[mode][userId] =
    used + 1;

  const updated =
    await saveWordChainConfig(
      client,
      guildId,
      {
        ...current,
        hintUses,
      },
    );

  return {
    ok: true,

    reason: null,

    used:
      used + 1,

    remaining:
      2 - (used + 1),

    word,

    config:
      updated,
  };
}

/**
 * =========================================================
 * RECORD USER SUCCESS
 * =========================================================
 *
 * PvE:
 * - User +1 V
 * - User +1 personal streak
 * - Bot không có streak
 *
 * PvP:
 * - User +1 V
 * - Global streak +1
 */

export async function recordUserSuccess(
  client,
  guildId,
  userId,
  word,
) {
  const current =
    await getWordChainConfig(
      client,
      guildId,
    );

  const normalized =
    normalizeWord(word);

  const mode =
    current.mode === 'pvp'
      ? 'pvp'
      : 'bot';

  const leaderboard = {
    bot: {
      ...(current.leaderboard?.bot || {}),
    },

    pvp: {
      ...(current.leaderboard?.pvp || {}),
    },
  };

  const existingStats =
    leaderboard[mode][userId];

  const stats =
    existingStats &&
    typeof existingStats === 'object'
      ? {
          correct:
            Number(
              existingStats.correct || 0,
            ),

          wrong:
            Number(
              existingStats.wrong || 0,
            ),
        }
      : {
          correct:
            Number(
              existingStats || 0,
            ),

          wrong: 0,
        };

  stats.correct += 1;

  leaderboard[mode][userId] =
    stats;

  const personalStreaks = {
    bot: {
      ...(current.personalStreaks?.bot || {}),
    },

    pvp: {
      ...(current.personalStreaks?.pvp || {}),
    },
  };

  let nextStreak = 0;

  if (
    mode === 'bot'
  ) {
    nextStreak =
      Number(
        personalStreaks.bot[userId] || 0,
      ) + 1;

    personalStreaks.bot[userId] =
      nextStreak;
  } else {
    nextStreak =
      Number(
        current.currentStreak || 0,
      ) + 1;
  }

  const nextUsedWords = [
    ...(current.usedWords || []),
    normalized,
  ];

  const updated = {
    ...current,

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
          current.bestStreak || 0,
        ),
        nextStreak,
      ),

    personalStreaks,

    leaderboard,
  };

  return saveWordChainConfig(
    client,
    guildId,
    updated,
  );
}

/**
 * =========================================================
 * RECORD USER FAILURE
 * =========================================================
 *
 * +1 X
 *
 * Không reset streak.
 */

export async function recordUserFailure(
  client,
  guildId,
  userId,
) {
  const current =
    await getWordChainConfig(
      client,
      guildId,
    );

  const mode =
    current.mode === 'pvp'
      ? 'pvp'
      : 'bot';

  const leaderboard = {
    bot: {
      ...(current.leaderboard?.bot || {}),
    },

    pvp: {
      ...(current.leaderboard?.pvp || {}),
    },
  };

  const existingStats =
    leaderboard[mode][userId];

  const stats =
    existingStats &&
    typeof existingStats === 'object'
      ? {
          correct:
            Number(
              existingStats.correct || 0,
            ),

          wrong:
            Number(
              existingStats.wrong || 0,
            ),
        }
      : {
          correct:
            Number(
              existingStats || 0,
            ),

          wrong: 0,
        };

  stats.wrong += 1;

  leaderboard[mode][userId] =
    stats;

  return saveWordChainConfig(
    client,
    guildId,
    {
      ...current,
      leaderboard,
    },
  );
}

/**
 * =========================================================
 * RECORD BOT SUCCESS
 * =========================================================
 *
 * Bot:
 * - Không +V
 * - Không +X
 * - Không +streak
 *
 * Chỉ cập nhật:
 * - currentWord
 * - usedWords
 */

export async function recordBotSuccess(
  client,
  guildId,
  botWord,
) {
  const current =
    await getWordChainConfig(
      client,
      guildId,
    );

  const normalized =
    normalizeWord(botWord);

  if (
    !isValidWord(normalized)
  ) {
    return current;
  }

  const nextUsedWords = [
    ...(current.usedWords || []),
    normalized,
  ];

  const updated = {
    ...current,

    currentWord:
      normalized,

    lastUserId:
      current.lastUserId ||
      null,

    usedWords:
      nextUsedWords,

    currentStreak:
      Number(
        current.currentStreak || 0,
      ),
  };

  return saveWordChainConfig(
    client,
    guildId,
    updated,
  );
}

/**
 * =========================================================
 * BREAK STREAK
 * =========================================================
 */

export async function recordBreak(
  client,
  guildId,
  newStartWord = null,
) {
  const current =
    await getWordChainConfig(
      client,
      guildId,
    );

  const normalizedStart =
    newStartWord
      ? normalizeWord(newStartWord)
      : null;

  const initialWord =
    normalizedStart &&
    isValidWord(normalizedStart)
      ? normalizedStart
      : getRandomStartWord();

  const nextState = {
    ...current,

    currentWord:
      initialWord,

    lastUserId:
      null,

    usedWords:
      initialWord
        ? [initialWord]
        : [],

    currentStreak: 0,

    personalStreaks: {
      bot: {},
      pvp: {},
    },

    hintUses: {
      bot: {},
      pvp: {},
    },
  };

  return saveWordChainConfig(
    client,
    guildId,
    nextState,
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
  const leaderboard =
    config?.leaderboard?.[mode] || {};

  return Object.entries(
    leaderboard,
  )
    .map(
      ([userId, value]) => {
        if (
          value &&
          typeof value === 'object'
        ) {
          const correct =
            Math.max(
              0,
              Number(
                value.correct || 0,
              ),
            );

          const wrong =
            Math.max(
              0,
              Number(
                value.wrong || 0,
              ),
            );

          return {
            userId,
            score: correct,
            correct,
            wrong,
          };
        }

        const correct =
          Math.max(
            0,
            Number(value || 0),
          );

        return {
          userId,
          score: correct,
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
