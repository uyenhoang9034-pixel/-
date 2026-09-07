import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * =========================================================
 * WORD CHAIN CONSTANTS
 * =========================================================
 */

export const WORD_CHAIN_CHANNELS = {
  pvp: '1545291672504508416',
  bot: '1546428675367505920',
};

export const WORD_CHAIN_HINT_LIMIT = 3;

const WORD_CHAIN_KEY_PREFIX = 'wordChain:';

/**
 * =========================================================
 * DICTIONARY
 * =========================================================
 */

let validWordsSet = new Set();
let startWordMap = new Map();
let isDictionaryLoaded = false;

/**
 * =========================================================
 * WORD CHAIN MODES
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
 * INIT DICTIONARY
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

    if (!Array.isArray(words)) {
      logger.error(
        'Vietnamese dictionary must be an array.',
      );

      return;
    }

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

      const parts =
        cleaned.split(' ');

      /**
       * Chỉ nhận từ ghép đúng 2 tiếng.
       */
      if (
        parts.length !== 2
      ) {
        continue;
      }

      /**
       * Chỉ nhận chữ cái.
       *
       * Cho phép Unicode tiếng Việt.
       */
      if (
        !parts.every(
          (part) =>
            /^\p{L}+$/u.test(part),
        )
      ) {
        continue;
      }

      validWordsSet.add(
        cleaned,
      );

      const first =
        parts[0];

      if (
        !startWordMap.has(first)
      ) {
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
 * DEFAULT GAME
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

    /**
     * PvE:
     * {
     *   userId: streak
     * }
     *
     * PvP:
     * không dùng personal streak.
     */
    personalStreaks: {},

    /**
     * {
     *   userId: number
     * }
     */
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

  games: {
    pvp:
      createDefaultGame(
        'pvp',
      ),

    bot:
      createDefaultGame(
        'bot',
      ),
  },

  leaderboard: {
    bot: {},
    pvp: {},
  },
};

/**
 * =========================================================
 * GET MODE BY CHANNEL
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
    const [
      userId,
      value,
    ] of Object.entries(
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
              value.correct ||
                0,
            ),
          ),

        wrong:
          Math.max(
            0,
            Number(
              value.wrong ||
                0,
            ),
          ),

        /**
         * PvE:
         * chuỗi cao nhất.
         */
        bestStreak:
          Math.max(
            0,
            Number(
              value.bestStreak ||
                0,
            ),
          ),
      };

      continue;
    }

    /**
     * Migration dữ liệu cũ:
     *
     * userId: score
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

      bestStreak: 0,
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
  value,
) {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(
      value,
    ).map(
      ([
        userId,
        streak,
      ]) => [
        userId,
        Math.max(
          0,
          Number(
            streak || 0,
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
  value,
) {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(
      value,
    ).map(
      ([
        userId,
        uses,
      ]) => [
        userId,
        Math.max(
          0,
          Math.min(
            WORD_CHAIN_HINT_LIMIT,
            Number(
              uses || 0,
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
  const game = {
    ...createDefaultGame(
      mode,
    ),

    ...(rawGame || {}),
  };

  game.mode =
    mode;

  /**
   * Channel luôn cố định.
   */
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
            normalizeWord,
          )
          .filter(Boolean)
      : [];

  game.currentStreak =
    Math.max(
      0,
      Number(
        game.currentStreak ||
          0,
      ),
    );

  game.bestStreak =
    Math.max(
      0,
      Number(
        game.bestStreak ||
          0,
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
 * =========================================================
 * NORMALIZE WHOLE CONFIG
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

  /**
   * -------------------------------------------------------
   * LEADERBOARD
   * -------------------------------------------------------
   */

  const rawLeaderboard =
    raw.leaderboard &&
    typeof raw.leaderboard === 'object'
      ? raw.leaderboard
      : {};

  const leaderboard =
    rawLeaderboard.bot ||
    rawLeaderboard.pvp
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
          /**
           * Migration config cũ.
           *
           * Leaderboard cũ được giữ
           * ở PvE.
           */
          bot:
            normalizeLeaderboardMode(
              rawLeaderboard,
            ),

          pvp: {},
        };

  /**
   * -------------------------------------------------------
   * GAMES
   * -------------------------------------------------------
   */

  let games;

  /**
   * Config mới.
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
     * -----------------------------------------------------
     * MIGRATE CONFIG CŨ
     * -----------------------------------------------------
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
      raw.channelId ||
      null,

    mode:
      raw.mode === 'pvp'
        ? 'pvp'
        : 'bot',
  };
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

/**
 * =========================================================
 * GET CONFIG
 * =========================================================
 */

export async function getWordChainConfig(
  client,
  guildId,
) {
  try {
    const rawState =
      await client.db.get(
        getStorageKey(
          guildId,
        ),
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

/**
 * =========================================================
 * SAVE CONFIG
 * =========================================================
 */

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
    getStorageKey(
      guildId,
    ),
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

  /**
   * Nếu setup truyền từ hợp lệ
   * thì dùng từ đó.
   *
   * Nếu không:
   * chọn ngẫu nhiên toàn dictionary.
   */
  const initialWord =
    normalizedStart &&
    isValidWord(
      normalizedStart,
    )
      ? normalizedStart
      : getRandomStartWord();

  const oldGame =
    current.games?.[
      resolvedMode
    ] ||
    createDefaultGame(
      resolvedMode,
    );

  current.games[
    resolvedMode
  ] = {
    ...createDefaultGame(
      resolvedMode,
    ),

    enabled: true,

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

    /**
     * Giữ best streak cũ.
     */
    bestStreak:
      Number(
        oldGame.bestStreak ||
          0,
      ),

    personalStreaks:
      {},

    hintUses:
      {},
  };

  current.enabled =
    true;

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
  ].enabled =
    false;

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
 * RESET GAME
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

  const existingGame =
    current.games[
      resolvedMode
    ] ||
    createDefaultGame(
      resolvedMode,
    );

  const normalizedStart =
    startWord
      ? normalizeWord(
          startWord,
        )
      : null;

  /**
   * Nếu không truyền startWord:
   * lấy random từ toàn dictionary.
   *
   * Không còn danh sách cố định
   * gia đình / bạn bè / học sinh...
   */
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

    /**
     * Giữ best streak.
     */
    bestStreak:
      Number(
        existingGame.bestStreak ||
          0,
      ),

    /**
     * Reset streak hiện tại
     * của round.
     */
    personalStreaks:
      {},

    /**
     * Reset hint.
     */
    hintUses:
      {},
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
    normalizeWord(
      word,
    );

  if (!cleaned) {
    return false;
  }

  const parts =
    cleaned.split(' ');

  /**
   * Phải đúng 2 tiếng.
   */
  if (
    parts.length !== 2
  ) {
    return false;
  }

  /**
   * Chỉ chữ cái.
   */
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
 *
 * Tìm ngẫu nhiên một từ:
 *
 * - nối được với từ hiện tại
 * - có trong dictionary
 * - chưa được dùng
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
      Array.isArray(
        usedWords,
      )
        ? usedWords
            .map(
              normalizeWord,
            )
            .filter(Boolean)
        : [],
    );

  const availableCandidates =
    candidates.filter(
      (word) => {
        if (
          usedSet.has(
            word,
          )
        ) {
          return false;
        }

        return isValidWord(
          word,
        );
      },
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
 *
 * Mỗi round:
 * lấy ngẫu nhiên một từ trong
 * toàn bộ dictionary.
 *
 * Không còn danh sách cố định.
 */

export function getRandomStartWord(
  excludeWords = [],
) {
  initDictionary();

  const excluded =
    new Set(
      Array.isArray(
        excludeWords,
      )
        ? excludeWords
            .map(
              normalizeWord,
            )
            .filter(Boolean)
        : [],
    );

  const availableWords =
    Array.from(
      validWordsSet,
    ).filter(
      (word) =>
        !excluded.has(
          word,
        ) &&
        isValidWord(
          word,
        ),
    );

  if (
    availableWords.length > 0
  ) {
    return availableWords[
      Math.floor(
        Math.random() *
          availableWords.length,
      )
    ];
  }

  /**
   * Fallback nếu dictionary
   * nhỏ hơn exclude list.
   */
  const allWords =
    Array.from(
      validWordsSet,
    ).filter(
      (word) =>
        isValidWord(
          word,
        ),
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

  /**
   * Fallback cuối cùng.
   */
  return 'học sinh';
}

/**
 * =========================================================
 * WORD CHAIN HINT
 * =========================================================
 *
 * Mỗi user có tối đa:
 *
 * 3 hint / round.
 *
 * Hint:
 * - không tính V
 * - không tính X
 * - không tăng streak
 * - không thay đổi currentWord
 * - không thêm vào usedWords
 *
 * Nếu không còn từ:
 * - KHÔNG trừ hint
 * - trả reason = no_word
 *
 * noitu.js có thể dùng kết quả
 * này để kết thúc round.
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

  /**
   * Game không hoạt động.
   */
  if (
    !game.enabled
  ) {
    return {
      ok: false,

      reason:
        'disabled',

      used: 0,

      remaining:
        WORD_CHAIN_HINT_LIMIT,

      word: null,

      config:
        current,
    };
  }

  const hintUses = {
    ...(game.hintUses || {}),
  };

  const used =
    Math.max(
      0,
      Math.min(
        WORD_CHAIN_HINT_LIMIT,
        Number(
          hintUses[userId] ||
            0,
        ),
      ),
    );

  /**
   * -------------------------------------------------------
   * ĐÃ HẾT HINT
   * -------------------------------------------------------
   */

  if (
    used >=
    WORD_CHAIN_HINT_LIMIT
  ) {
    return {
      ok: false,

      reason:
        'limit',

      used,

      remaining: 0,

      word: null,

      config:
        current,
    };
  }

  /**
   * -------------------------------------------------------
   * TÌM TỪ GỢI Ý
   * -------------------------------------------------------
   */

  const word =
    findBotNextWord(
      game.currentWord,

      game.usedWords ||
        [],
    );

  /**
   * -------------------------------------------------------
   * KHÔNG CÒN TỪ
   * -------------------------------------------------------
   *
   * Không tăng hintUses.
   *
   * Quan trọng:
   *
   * Đây KHÔNG phải lỗi.
   *
   * noitu.js có thể xử lý:
   *
   * reason === 'no_word'
   *
   * để kết thúc round.
   */

  if (!word) {
    return {
      ok: false,

      reason:
        'no_word',

      used,

      remaining:
        WORD_CHAIN_HINT_LIMIT -
        used,

      word: null,

      config:
        current,
    };
  }

  /**
   * -------------------------------------------------------
   * CÓ TỪ
   * -------------------------------------------------------
   */

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
 *
 * PvE:
 * - +1 correct
 * - +1 personal streak
 * - update bestStreak
 *
 * PvP:
 * - +1 correct
 * - +1 streak chung
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
    normalizeWord(
      word,
    );

  const leaderboard = {
    bot: {
      ...(current.leaderboard?.bot ||
        {}),
    },

    pvp: {
      ...(current.leaderboard?.pvp ||
        {}),
    },
  };

  const existing =
    leaderboard[
      resolvedMode
    ][userId];

  const stats =
    existing &&
    typeof existing === 'object'
      ? {
          correct:
            Number(
              existing.correct ||
                0,
            ),

          wrong:
            Number(
              existing.wrong ||
                0,
            ),

          bestStreak:
            Number(
              existing.bestStreak ||
                0,
            ),
        }
      : {
          correct:
            Number(
              existing || 0,
            ),

          wrong: 0,

          bestStreak: 0,
        };

  /**
   * +1 từ đúng.
   */
  stats.correct += 1;

  let nextStreak;

  const personalStreaks =
    normalizePersonalStreaks(
      game.personalStreaks,
    );

  /**
   * -------------------------------------------------------
   * PVE
   * -------------------------------------------------------
   */

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
    ] =
      nextStreak;

    /**
     * Leaderboard PvE:
     * tính theo chuỗi cao nhất.
     */
    stats.bestStreak =
      Math.max(
        stats.bestStreak,
        nextStreak,
      );
  }

  /**
   * -------------------------------------------------------
   * PVP
   * -------------------------------------------------------
   */

  else {
    nextStreak =
      Number(
        game.currentStreak ||
          0,
      ) + 1;
  }

  leaderboard[
    resolvedMode
  ][userId] =
    stats;

  /**
   * -------------------------------------------------------
   * UPDATE GAME
   * -------------------------------------------------------
   */

  current.games[
    resolvedMode
  ] = {
    ...game,

    currentWord:
      normalized,

    lastUserId:
      userId,

    usedWords: [
      ...(game.usedWords || []),

      normalized,
    ],

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
 *
 * Mỗi lượt sai:
 *
 * +1 X
 *
 * Không reset streak ở đây.
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
      ...(current.leaderboard?.bot ||
        {}),
    },

    pvp: {
      ...(current.leaderboard?.pvp ||
        {}),
    },
  };

  const existing =
    leaderboard[
      resolvedMode
    ][userId];

  const stats =
    existing &&
    typeof existing === 'object'
      ? {
          correct:
            Number(
              existing.correct ||
                0,
            ),

          wrong:
            Number(
              existing.wrong ||
                0,
            ),

          bestStreak:
            Number(
              existing.bestStreak ||
                0,
            ),
        }
      : {
          correct:
            Number(
              existing || 0,
            ),

          wrong: 0,

          bestStreak: 0,
        };

  stats.wrong += 1;

  leaderboard[
    resolvedMode
  ][userId] =
    stats;

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
 *
 * Bot:
 *
 * - không + V
 * - không + X
 * - không + streak
 *
 * Chỉ:
 *
 * - đổi currentWord
 * - thêm usedWords
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

  current.games[
    resolvedMode
  ] = {
    ...game,

    currentWord:
      normalized,

    usedWords: [
      ...(game.usedWords || []),

      normalized,
    ],

    /**
     * Bot không phải player.
     */
    lastUserId:
      game.lastUserId ||
      null,

    /**
     * Không tăng streak.
     */
    currentStreak:
      Number(
        game.currentStreak ||
          0,
      ),
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
 * BREAK / END ROUND
 * =========================================================
 *
 * Khi round kết thúc:
 *
 * - currentWord -> từ mới
 * - lastUserId -> null
 * - usedWords -> reset
 * - currentStreak -> 0
 * - personalStreaks -> reset
 * - hintUses -> reset
 *
 * Leaderboard KHÔNG reset.
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

  /**
   * Nếu không có startWord:
   * chọn random từ dictionary.
   *
   * Không dùng danh sách cố định.
   */
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

    /**
     * Không xoá bestStreak.
     */
    bestStreak:
      Number(
        game.bestStreak ||
          0,
      ),

    /**
     * Reset streak hiện tại.
     */
    personalStreaks:
      {},

    /**
     * Reset 3 lượt hint.
     */
    hintUses:
      {},
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
 *
 * PvP:
 *   score = correct
 *
 * PvE:
 *   score = bestStreak
 *
 * Vì vậy:
 *
 * PvE Top 1 = người có chuỗi
 * cao nhất từng đạt với Bot.
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
      ([
        userId,
        value,
      ]) => {
        const stats =
          value &&
          typeof value === 'object'
            ? {
                correct:
                  Math.max(
                    0,
                    Number(
                      value.correct ||
                        0,
                    ),
                  ),

                wrong:
                  Math.max(
                    0,
                    Number(
                      value.wrong ||
                        0,
                    ),
                  ),

                bestStreak:
                  Math.max(
                    0,
                    Number(
                      value.bestStreak ||
                        0,
                    ),
                  ),
              }
            : {
                correct:
                  Math.max(
                    0,
                    Number(
                      value || 0,
                    ),
                  ),

                wrong: 0,

                bestStreak: 0,
              };

        /**
         * ---------------------------------------------------
         * PVE
         * ---------------------------------------------------
         *
         * Xếp theo chuỗi cao nhất.
         */

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

        /**
         * ---------------------------------------------------
         * PVP
         * ---------------------------------------------------
         *
         * Giữ nguyên:
         * xếp theo số từ đúng.
         */

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

    /**
     * -----------------------------------------------------
     * FILTER
     * -----------------------------------------------------
     */

    .filter(
      (entry) =>
        resolvedMode === 'bot'
          ? entry.bestStreak > 0 ||
            entry.correct > 0 ||
            entry.wrong > 0
          : entry.correct > 0 ||
            entry.wrong > 0,
    )

    /**
     * -----------------------------------------------------
     * SORT
     * -----------------------------------------------------
     */

    .sort(
      (
        a,
        b,
      ) => {
        /**
         * Điểm chính.
         *
         * PvP = correct
         * PvE = bestStreak
         */
        if (
          b.score !==
          a.score
        ) {
          return (
            b.score -
            a.score
          );
        }

        /**
         * Nếu bằng điểm:
         * ưu tiên correct.
         */
        if (
          b.correct !==
          a.correct
        ) {
          return (
            b.correct -
            a.correct
          );
        }

        /**
         * Cuối cùng:
         * ít lỗi hơn đứng trên.
         */
        return (
          a.wrong -
          b.wrong
        );
      },
    );
}
