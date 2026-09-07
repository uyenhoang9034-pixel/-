import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const WORD_CHAIN_CHANNELS = {
  pvp: '1545291672504508416',
  bot: '1546428675367505920',
};

export const WORD_CHAIN_HINT_LIMIT = 3;
const WORD_CHAIN_KEY_PREFIX = 'wordChain:';

let validWordsSet = new Set();
let startWordMap = new Map();
let isDictionaryLoaded = false;

export const WORD_CHAIN_MODES = {
  pvp: {
    label: 'Đấu với người chơi (PvP)',
    description: 'Các thành viên trong server thay phiên nhau nối từ.',
    value: 'pvp',
  },

  bot: {
    label: 'Đấu với Bot (PvE)',
    description: 'Người chơi nối từ, Bot sẽ tự động tìm từ nối tiếp.',
    value: 'bot',
  },
};

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

    const words = JSON.parse(
      fs.readFileSync(dictPath, 'utf8'),
    );

    validWordsSet = new Set();
    startWordMap = new Map();

    for (const word of words) {
      const cleaned = String(word)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

      if (!cleaned) continue;

      validWordsSet.add(cleaned);

      const parts = cleaned.split(' ');

      if (parts.length !== 2) continue;

      if (!startWordMap.has(parts[0])) {
        startWordMap.set(parts[0], []);
      }

      startWordMap
        .get(parts[0])
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

function createDefaultGame(mode) {
  return {
    enabled: false,

    channelId:
      WORD_CHAIN_CHANNELS[mode] || null,

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
          Number(
            value.correct || 0,
          ),
        ),

        wrong: Math.max(
          0,
          Number(
            value.wrong || 0,
          ),
        ),

        /*
         * PvE:
         * Lưu chuỗi cao nhất của từng người.
         */
        bestStreak: Math.max(
          0,
          Number(
            value.bestStreak || 0,
          ),
        ),
      };
    } else {
      /*
       * Dữ liệu leaderboard cũ.
       */
      normalized[userId] = {
        correct: Math.max(
          0,
          Number(value || 0),
        ),

        wrong: 0,

        bestStreak: 0,
      };
    }
  }

  return normalized;
}

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
    Object.entries(value).map(
      ([userId, streak]) => [
        userId,
        Math.max(
          0,
          Number(streak || 0),
        ),
      ],
    ),
  );
}

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
    Object.entries(value).map(
      ([userId, uses]) => [
        userId,
        Math.max(
          0,
          Math.min(
            WORD_CHAIN_HINT_LIMIT,
            Number(uses || 0),
          ),
        ),
      ],
    ),
  );
}

function normalizeGame(
  rawGame,
  mode,
) {
  const game = {
    ...createDefaultGame(mode),
    ...(rawGame || {}),
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
    game.lastUserId || null;

  game.usedWords =
    Array.isArray(
      game.usedWords,
    )
      ? game.usedWords
          .map(normalizeWord)
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
          bot:
            normalizeLeaderboardMode(
              rawLeaderboard,
            ),

          pvp: {},
        };

  let games;

  /*
   * Config mới.
   */
  if (
    raw.games &&
    typeof raw.games === 'object'
  ) {
    games = {
      pvp: normalizeGame(
        raw.games.pvp,
        'pvp',
      ),

      bot: normalizeGame(
        raw.games.bot,
        'bot',
      ),
    };
  } else {
    /*
     * Migration config cũ.
     */
    const oldMode =
      raw.mode === 'pvp'
        ? 'pvp'
        : 'bot';

    const oldGame =
      normalizeGame(
        {
          enabled:
            Boolean(raw.enabled),

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
        createDefaultGame('pvp'),

      bot:
        createDefaultGame('bot'),
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
      raw.channelId || null,

    mode:
      raw.mode === 'pvp'
        ? 'pvp'
        : 'bot',
  };
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
    return normalizeWordChainConfig(
      await client.db.get(
        getStorageKey(guildId),
      ),
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
    WORD_CHAIN_CHANNELS[
      resolvedMode
    ];

  return saveWordChainConfig(
    client,
    guildId,
    current,
  );
}

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

  const existingGame =
    current.games[
      resolvedMode
    ] ||
    createDefaultGame(
      resolvedMode,
    );

  const initialWord =
    normalizedStart &&
    isValidWord(
      normalizedStart,
    )
      ? normalizedStart
      : getRandomStartWord(
          existingGame.usedWords || [],
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
          !validWordsSet.has(
            word,
          )
        ) {
          return false;
        }

        if (
          !isValidWord(
            word,
          )
        ) {
          return false;
        }

        if (
          usedSet.has(
            word,
          )
        ) {
          return false;
        }

        return true;
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
 * Mỗi round chọn một từ
 * ngẫu nhiên từ toàn bộ dictionary.
 *
 * Không còn danh sách:
 * gia đình / bạn bè / học sinh...
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

  return 'học sinh';
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

  /*
   * +1 từ đúng.
   */
  stats.correct += 1;

  let nextStreak;

  const personalStreaks =
    normalizePersonalStreaks(
      game.personalStreaks,
    );

  if (
    resolvedMode === 'bot'
  ) {
    /*
     * PvE:
     * mỗi người có streak riêng.
     */
    nextStreak =
      Number(
        personalStreaks[
          userId
        ] || 0,
      ) + 1;

    personalStreaks[
      userId
    ] = nextStreak;

    /*
     * Lưu best streak vĩnh viễn
     * cho leaderboard PvE.
     */
    stats.bestStreak =
      Math.max(
        stats.bestStreak,
        nextStreak,
      );
  } else {
    /*
     * PvP:
     * dùng streak chung của ván.
     */
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
          game.bestStreak || 0,
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

    /*
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
      : getRandomStartWord(
          [
            ...(game.usedWords || []),
            game.currentWord,
          ].filter(Boolean),
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
      ([userId, value]) => {
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

        /*
         * PvE:
         * xếp theo bestStreak.
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

        /*
         * PvP:
         * giữ nguyên xếp theo số từ đúng.
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
    .filter(
      (entry) =>
        resolvedMode === 'bot'
          ? entry.bestStreak > 0 ||
            entry.correct > 0 ||
            entry.wrong > 0
          : entry.correct > 0 ||
            entry.wrong > 0,
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
          b.wrong -
          a.wrong
        );
      },
    );
}
