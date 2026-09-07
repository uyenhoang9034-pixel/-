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

  leaderboard: {
  bot: {},
  pvp: {},
},
};

function normalizeWordChainConfig(state) {
  const normalized = {
    ...DEFAULT_WORD_CHAIN_CONFIG,
    ...(state || {}),
  };

  if (!WORD_CHAIN_MODES[normalized.mode]) {
    normalized.mode = 'bot';
  }

  normalized.usedWords =
    Array.isArray(
      normalized.usedWords,
    )
      ? normalized.usedWords
      : [];

  const rawLeaderboard =
  normalized.leaderboard &&
  typeof normalized.leaderboard ===
    'object'
    ? normalized.leaderboard
    : {};

const hasModeLeaderboard =
  rawLeaderboard.bot ||
  rawLeaderboard.pvp;

if (hasModeLeaderboard) {
  normalized.leaderboard = {
    bot:
      rawLeaderboard.bot &&
      typeof rawLeaderboard.bot ===
        'object'
        ? {
            ...rawLeaderboard.bot,
          }
        : {},

    pvp:
      rawLeaderboard.pvp &&
      typeof rawLeaderboard.pvp ===
        'object'
        ? {
            ...rawLeaderboard.pvp,
          }
        : {},
  };
} else {
  /**
   * Dữ liệu leaderboard cũ
   *
   * Trước khi tách PvE / PvP,
   * leaderboard có dạng:
   *
   * {
   *   userId: score
   * }
   *
   * Không thể biết chính xác dữ liệu cũ
   * thuộc mode nào nên giữ lại ở PvE
   * để không làm mất dữ liệu.
   */
  normalized.leaderboard = {
    bot: {
      ...rawLeaderboard,
    },

    pvp: {},
  };
}

  normalized.currentStreak =
    Number(
      normalized.currentStreak || 0,
    );

  normalized.bestStreak =
    Number(
      normalized.bestStreak || 0,
    );

  return normalized;
}

function getStorageKey(guildId) {
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

    // Từ mở đầu KHÔNG tính là một lượt nối.
    currentStreak: 0,
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

export function normalizeWord(word) {
  if (typeof word !== 'string') {
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

export function isValidWord(word) {
  initDictionary();

  const cleaned =
    normalizeWord(word);

  const parts =
    cleaned.split(' ');

  if (parts.length !== 2) {
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
  if (!prevWord || !nextWord) {
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

export function getLastSyllable(word) {
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

export function getFirstSyllable(word) {
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
      usedWords.map((word) =>
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
 * Chỉ người chơi được tính vào leaderboard.
 *
 * Mỗi từ đúng:
 * - +1 từ cho user
 * - +1 streak
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

  leaderboard[mode][userId] =
    Number(
      leaderboard[mode][userId] || 0,
    ) + 1;

  const nextStreak =
    Number(
      current.currentStreak || 0,
    ) + 1;

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
 * RECORD BOT SUCCESS
 * =========================================================
 *
 * Bot không được tính leaderboard.
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

  const nextStreak =
    Number(
      current.currentStreak || 0,
    ) + 1;

  const nextUsedWords = [
    ...(current.usedWords || []),
    normalized,
  ];

  const updated = {
    ...current,

    currentWord:
      normalized,

    lastUserId:
      client.user?.id ||
      null,

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
 * Tạo từ mới nhưng KHÔNG tính từ mở đầu vào streak.
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
 * Score = số từ người chơi đã trả lời đúng.
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
}
