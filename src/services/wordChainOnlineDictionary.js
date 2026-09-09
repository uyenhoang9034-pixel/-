import axios from 'axios';

import {
  logger,
} from '../utils/logger.js';

/**
 * =========================================================
 * CONFIG
 * =========================================================
 *
 * Thứ tự fallback:
 *
 * 1. Cache
 * 2. Google Custom Search nếu có API key
 * 3. Vietnamese Wiktionary
 *
 * Google là OPTIONAL.
 *
 * Nếu chưa có:
 *
 * GOOGLE_CSE_API_KEY
 * GOOGLE_CSE_CX
 *
 * thì hệ thống vẫn chạy bằng Wiktionary.
 */

const GOOGLE_API_KEY =
  process.env.GOOGLE_CSE_API_KEY ||
  null;

const GOOGLE_CX =
  process.env.GOOGLE_CSE_CX ||
  null;

/**
 * Cache 30 ngày.
 */
const CACHE_TTL_MS =
  30 * 24 * 60 * 60 * 1000;

/**
 * Không chờ website quá lâu.
 */
const REQUEST_TIMEOUT_MS =
  5000;

const MAX_RESULTS =
  20;

/**
 * Cache RAM.
 *
 * exact:
 * word -> boolean
 *
 * prefix:
 * syllable -> string[]
 */

const exactMemoryCache =
  new Map();

const prefixMemoryCache =
  new Map();

/**
 * =========================================================
 * NORMALIZE
 * =========================================================
 */

export function normalizeOnlineWord(
  value,
) {
  return String(
    value || '',
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      ' ',
    );
}

/**
 * =========================================================
 * VALID 2-SYLLABLE SHAPE
 * =========================================================
 */

export function isValidOnlineWordShape(
  word,
) {
  const normalized =
    normalizeOnlineWord(
      word,
    );

  if (!normalized) {
    return false;
  }

  const parts =
    normalized
      .split(' ')
      .filter(Boolean);

  if (
    parts.length !== 2
  ) {
    return false;
  }

  return parts.every(
    part =>
      /^\p{L}+$/u.test(
        part,
      ),
  );
}

/**
 * =========================================================
 * DB CACHE KEYS
 * =========================================================
 */

function getExactCacheKey(
  word,
) {
  return (
    'wordChain:online:exact:' +
    encodeURIComponent(
      normalizeOnlineWord(
        word,
      ),
    )
  );
}

function getPrefixCacheKey(
  syllable,
) {
  return (
    'wordChain:online:prefix:' +
    encodeURIComponent(
      normalizeOnlineWord(
        syllable,
      ),
    )
  );
}

/**
 * =========================================================
 * READ CACHE
 * =========================================================
 */

async function readDbCache(
  client,
  key,
) {
  try {
    if (
      !client?.db ||
      typeof client.db.get !==
        'function'
    ) {
      return null;
    }

    const data =
      await client.db.get(
        key,
        null,
      );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      return null;
    }

    if (
      !data.cachedAt ||
      Date.now() -
        Number(
          data.cachedAt,
        ) >
        CACHE_TTL_MS
    ) {
      return null;
    }

    return data.value;
  } catch (error) {
    logger.debug(
      'Word Chain online cache read failed',
      {
        key,
        error:
          error?.message ||
          String(error),
      },
    );

    return null;
  }
}

/**
 * =========================================================
 * WRITE CACHE
 * =========================================================
 */

async function writeDbCache(
  client,
  key,
  value,
) {
  try {
    if (
      !client?.db ||
      typeof client.db.set !==
        'function'
    ) {
      return;
    }

    await client.db.set(
      key,
      {
        cachedAt:
          Date.now(),

        value,
      },
    );
  } catch (error) {
    /**
     * Cache lỗi không được phép
     * làm hỏng game.
     */

    logger.debug(
      'Word Chain online cache write failed',
      {
        key,
        error:
          error?.message ||
          String(error),
      },
    );
  }
}

/**
 * =========================================================
 * GOOGLE SEARCH
 * =========================================================
 *
 * Chỉ hoạt động nếu bạn có:
 *
 * GOOGLE_CSE_API_KEY
 * GOOGLE_CSE_CX
 *
 * Không có cũng không sao.
 */

async function googleSearch(
  query,
) {
  if (
    !GOOGLE_API_KEY ||
    !GOOGLE_CX
  ) {
    return [];
  }

  try {
    const response =
      await axios.get(
        'https://www.googleapis.com/customsearch/v1',
        {
          timeout:
            REQUEST_TIMEOUT_MS,

          params: {
            key:
              GOOGLE_API_KEY,

            cx:
              GOOGLE_CX,

            q:
              query,

            num:
              10,

            lr:
              'lang_vi',
          },
        },
      );

    const items =
      Array.isArray(
        response.data?.items,
      )
        ? response.data.items
        : [];

    return items;
  } catch (error) {
    logger.warn(
      'Google Word Chain lookup failed',
      {
        query,
        error:
          error?.message ||
          String(error),
      },
    );

    return [];
  }
}

/**
 * =========================================================
 * GOOGLE EXACT WORD VALIDATION
 * =========================================================
 */

async function validateWithGoogle(
  word,
) {
  const normalized =
    normalizeOnlineWord(
      word,
    );

  const results =
    await googleSearch(
      `"${normalized}" tiếng Việt`,
    );

  if (
    results.length === 0
  ) {
    return false;
  }

  /**
   * Không chỉ nhìn xem Google có
   * trả kết quả hay không.
   *
   * Phrase phải thật sự xuất hiện
   * trong title/snippet.
   */

  const needle =
    normalized
      .toLowerCase();

  return results.some(
    item => {
      const text =
        [
          item.title,
          item.snippet,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

      return text.includes(
        needle,
      );
    },
  );
}

/**
 * =========================================================
 * WIKTIONARY PREFIX SEARCH
 * =========================================================
 */

async function searchWiktionary(
  query,
  limit = MAX_RESULTS,
) {
  try {
    const response =
      await axios.get(
        'https://vi.wiktionary.org/w/api.php',
        {
          timeout:
            REQUEST_TIMEOUT_MS,

          params: {
            action:
              'query',

            list:
              'prefixsearch',

            pssearch:
              query,

            pslimit:
              Math.min(
                50,
                Math.max(
                  1,
                  limit,
                ),
              ),

            format:
              'json',

            origin:
              '*',
          },
        },
      );

    const results =
      response.data
        ?.query
        ?.prefixsearch;

    if (
      !Array.isArray(
        results,
      )
    ) {
      return [];
    }

    return results
      .map(
        item =>
          normalizeOnlineWord(
            item.title,
          ),
      )
      .filter(Boolean);
  } catch (error) {
    logger.warn(
      'Wiktionary Word Chain lookup failed',
      {
        query,
        error:
          error?.message ||
          String(error),
      },
    );

    return [];
  }
}

/**
 * =========================================================
 * WIKTIONARY EXACT VALIDATION
 * =========================================================
 */

async function validateWithWiktionary(
  word,
) {
  const normalized =
    normalizeOnlineWord(
      word,
    );

  const results =
    await searchWiktionary(
      normalized,
      10,
    );

  return results.some(
    candidate =>
      candidate ===
      normalized,
  );
}

/**
 * =========================================================
 * ONLINE VALIDATION
 * =========================================================
 *
 * Dùng khi JSON không có từ.
 */

export async function isOnlineWordValid(
  client,
  word,
) {
  const normalized =
    normalizeOnlineWord(
      word,
    );

  /**
   * Sai format thì khỏi tra mạng.
   */

  if (
    !isValidOnlineWordShape(
      normalized,
    )
  ) {
    return false;
  }

  /**
   * RAM cache.
   */

  if (
    exactMemoryCache.has(
      normalized,
    )
  ) {
    return exactMemoryCache.get(
      normalized,
    );
  }

  /**
   * DB cache.
   */

  const dbKey =
    getExactCacheKey(
      normalized,
    );

  const cached =
    await readDbCache(
      client,
      dbKey,
    );

  if (
    typeof cached ===
    'boolean'
  ) {
    exactMemoryCache.set(
      normalized,
      cached,
    );

    return cached;
  }

  /**
   * =====================================================
   * SOURCE 1 — WIKTIONARY
   * =====================================================
   */

  let valid =
    await validateWithWiktionary(
      normalized,
    );

  /**
   * =====================================================
   * SOURCE 2 — GOOGLE
   * =====================================================
   *
   * Chỉ gọi nếu Wiktionary không có.
   */

  if (!valid) {
    valid =
      await validateWithGoogle(
        normalized,
      );
  }

  exactMemoryCache.set(
    normalized,
    valid,
  );

  await writeDbCache(
    client,
    dbKey,
    valid,
  );

  if (valid) {
    logger.info(
      'Word Chain accepted word from online dictionary',
      {
        word:
          normalized,
      },
    );
  }

  return valid;
}

/**
 * =========================================================
 * FIND WORDS STARTING WITH SYLLABLE
 * =========================================================
 *
 * Ví dụ:
 *
 * syllable = "hóa"
 *
 * có thể trả:
 *
 * hóa học
 * hóa chất
 * hóa thân
 */

export async function findOnlineWordsByFirstSyllable(
  client,
  syllable,
) {
  const normalizedSyllable =
    normalizeOnlineWord(
      syllable,
    );

  if (
    !normalizedSyllable ||
    !/^\p{L}+$/u.test(
      normalizedSyllable,
    )
  ) {
    return [];
  }

  /**
   * RAM cache.
   */

  if (
    prefixMemoryCache.has(
      normalizedSyllable,
    )
  ) {
    return [
      ...prefixMemoryCache.get(
        normalizedSyllable,
      ),
    ];
  }

  /**
   * DB cache.
   */

  const dbKey =
    getPrefixCacheKey(
      normalizedSyllable,
    );

  const cached =
    await readDbCache(
      client,
      dbKey,
    );

  if (
    Array.isArray(
      cached,
    )
  ) {
    prefixMemoryCache.set(
      normalizedSyllable,
      cached,
    );

    return [
      ...cached,
    ];
  }

  const results =
    await searchWiktionary(
      `${normalizedSyllable} `,
      50,
    );

  /**
   * Chỉ nhận chính xác 2 tiếng
   * và tiếng đầu phải đúng.
   */

  const valid =
    [
      ...new Set(
        results
          .filter(
            isValidOnlineWordShape,
          )
          .filter(
            word =>
              word
                .split(' ')[0] ===
              normalizedSyllable,
          ),
      ),
    ];

  prefixMemoryCache.set(
    normalizedSyllable,
    valid,
  );

  await writeDbCache(
    client,
    dbKey,
    valid,
  );

  return [
    ...valid,
  ];
}

/**
 * =========================================================
 * FIND NEXT ONLINE WORD
 * =========================================================
 */

export async function findOnlineNextWord(
  client,
  prevWord,
  usedWords = [],
) {
  const normalizedPrev =
    normalizeOnlineWord(
      prevWord,
    );

  const parts =
    normalizedPrev
      .split(' ')
      .filter(Boolean);

  if (
    parts.length !== 2
  ) {
    return null;
  }

  const needed =
    parts[1];

  const candidates =
    await findOnlineWordsByFirstSyllable(
      client,
      needed,
    );

  if (
    candidates.length === 0
  ) {
    return null;
  }

  const used =
    new Set(
      Array.isArray(
        usedWords,
      )
        ? usedWords
            .map(
              normalizeOnlineWord,
            )
            .filter(Boolean)
        : [],
    );

  const available =
    candidates.filter(
      word =>
        !used.has(
          word,
        ),
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
