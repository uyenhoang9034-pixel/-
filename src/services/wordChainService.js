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

      if (!cleaned) continue;

      validWordsSet.add(cleaned);

      const parts =
        cleaned.split(' ');

      if (parts.length === 2) {
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

const DEFAULT_WORD_CHAIN_CONFIG = {
  enabled: false,

  channelId: null,

  mode: 'bot',

  currentWord: null,

  lastUserId: null,

  usedWords: [],

  currentStreak: 0,

  bestStreak: 0,

  /**
   * =======================================================
   * PERSONAL STREAK
   * =======================================================
   *
   * PvE:
   *
   * {
   *   userId: streak
   * }
   *
   * Mỗi người có streak riêng.
   *
   * PvP không sử dụng map này.
   */
  personalStreaks: {
    bot: {},
    pvp: {},
  },

  /**
   * =======================================================
   * LEADERBOARD
   * =======================================================
   *
   * Mỗi user:
   *
   * {
   *   correct: 0,
   *   wrong: 0
   * }
   *
   * correct = V
   * wrong   = X
   */
  leaderboard: {
    bot: {},
    pvp: {},
  },
};

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
    /**
     * Dữ liệu mới:
     *
     * {
     *   correct: 10,
     *   wrong: 2
     * }
     */
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
     * Dữ liệu cũ:
     *
     * userId: 1201
     *
     * Giữ lại thành:
     *
     * {
     *   correct: 1201,
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

  return {
    bot:
      personalStreaks.bot &&
      typeof personalStreaks.bot === 'object'
        ? Object.fromEntries(
            Object.entries(
              personalStreaks.bot,
            ).map(
              ([userId, value]) => [
                userId,
                Math.max(
                  0,
                  Number(value || 0),
                ),
              ],
            ),
          )
        : {},

    pvp:
      personalStreaks.pvp &&
      typeof personalStreaks.pvp === 'object'
        ? Object.fromEntries(
            Object.entries(
              personalStreaks.pvp,
            ).map(
              ([userId, value]) => [
                userId,
                Math.max(
                  0,
                  Number(value || 0),
                ),
              ],
            ),
          )
        : {},
  };
}

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
      : [];

  /**
   * =======================================================
   * LEADERBOARD MIGRATION
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

  if (
    hasModeLeaderboard
  ) {
    normalized.leaderboard = {
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
     * Dữ liệu leaderboard cũ:
     *
     * {
     *   userId: score
     * }
     *
     * Giữ dữ liệu cũ ở PvE.
     */
    normalized.leaderboard = {
      bot:
        normalizeLeaderboardMode(
          rawLeaderboard,
        ),

      pvp: {},
    };
  }

  /**
   * =======================================================
   * PERSONAL STREAK MIGRATION
   * =======================================================
   */

  normalized.personalStreaks =
    normalizePersonalStreaks(
      normalized.personalStreaks,
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

  return normalized;
}

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

  const initialWord =
    startWord &&
    isValidWord(startWord)
      ? normalizeWord(startWord)
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

  const initialWord =
    startWord &&
    isValidWord(startWord)
      ? normalizeWord(startWord)
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
  };

  return saveWordChainConfig(
    client,
    guildId,
    nextState,
  );
}

/**
 * =========================================================
 * NORMALIZE
 * =========================================================
 */

export function normalizeWord(
  word,
) {
  if (
    typeof word !==
    'string'
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

  const parts =
    cleaned.split(' ');

  if (
    parts.length !== 2
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
          normalizeWord(word),
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
 * RANDOM START
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
 * RECORD USER SUCCESS
 * =========================================================
 *
 * Người chơi đúng:
 *
 * PvE:
 * - +1 V
 * - +1 personal streak
 * - KHÔNG tính bot
 *
 * PvP:
 * - +1 V
 * - +1 global streak
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

  /**
   * Hỗ trợ cả dữ liệu cũ
   * dạng number.
   */
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

  let nextStreak = 0;

  const personalStreaks = {
    bot: {
      ...(current.personalStreaks?.bot || {}),
    },

    pvp: {
      ...(current.personalStreaks?.pvp || {}),
    },
  };

  if (
    mode === 'bot'
  ) {
    /**
     * PvE:
     *
     * Chỉ user hiện tại tăng streak.
     *
     * Bot không liên quan.
     */
    nextStreak =
      Number(
        personalStreaks.bot[userId] || 0,
      ) + 1;

    personalStreaks.bot[userId] =
      nextStreak;
  } else {
    /**
     * PvP:
     *
     * Tất cả người chơi dùng chung
     * một streak của ván.
     */
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
 * Mỗi lần user gửi một lượt sai:
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
 *
 * - Không +V
 * - Không +X
 * - Không +streak
 *
 * Chỉ cập nhật từ hiện tại và usedWords.
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

  const nextUsedWords = [
    ...(current.usedWords || []),
    normalized,
  ];

  const updated = {
    ...current,

    currentWord:
      normalized,

    /**
     * Không dùng bot như một
     * người chơi thật.
     */
    lastUserId:
      current.lastUserId ||
      null,

    usedWords:
      nextUsedWords,

    /**
     * QUAN TRỌNG:
     *
     * Không tăng currentStreak.
     *
     * currentStreak hiện tại vẫn
     * là streak của user PvE.
     */
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
 *
 * Kết thúc ván:
 *
 * - PvP: reset global streak.
 * - PvE: reset streak cá nhân của tất cả user
 *   để bắt đầu một round mới.
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

  const initialWord =
    newStartWord &&
    isValidWord(newStartWord)
      ? normalizeWord(
          newStartWord,
        )
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

    currentStreak:
      0,

    personalStreaks: {
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
 *
 * Trả về:
 *
 * {
 *   userId,
 *   score,
 *   correct,
 *   wrong
 * }
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
      (
        [userId, value],
      ) => {
        /**
         * Dữ liệu mới.
         */
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

        /**
         * Dữ liệu cũ.
         */
        const correct =
          Math.max(
            0,
            Number(
              value || 0,
            ),
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
