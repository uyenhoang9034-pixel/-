import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_PATH = path.join(
  __dirname,
  '../data/vietnamese_words_source.txt',
);

const OUTPUT_PATH = path.join(
  __dirname,
  '../data/vietnamese_words.json',
);

/**
 * =========================================================
 * CONFIG
 * =========================================================
 */

const MIN_WORD_LENGTH = 1;
const MAX_WORD_LENGTH = 20;

/**
 * Chuẩn hóa chữ thường.
 *
 * Ví dụ:
 *
 * "BẠN BÈ"
 * "Bạn Bè"
 * "bạn bè"
 *
 * → "bạn bè"
 */
const NORMALIZE_LOWERCASE = true;

/**
 * =========================================================
 * NORMALIZE
 * =========================================================
 */

function normalizeWord(value) {
  if (
    typeof value !== 'string'
  ) {
    return '';
  }

  let word = value
    .trim()
    .normalize('NFC')
    .replace(/\s+/g, ' ');

  if (
    NORMALIZE_LOWERCASE
  ) {
    word =
      word.toLowerCase();
  }

  return word;
}

/**
 * =========================================================
 * VALID VIETNAMESE 2-SYLLABLE WORD
 * =========================================================
 */

function isValidTwoSyllableWord(
  word,
) {
  if (!word) {
    return false;
  }

  const parts =
    word.split(' ');

  /**
   * BẮT BUỘC ĐÚNG 2 TIẾNG
   */
  if (
    parts.length !== 2
  ) {
    return false;
  }

  /**
   * Chỉ cho phép chữ cái Unicode.
   *
   * \p{L} hỗ trợ Unicode,
   * bao gồm toàn bộ chữ tiếng Việt.
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

  /**
   * Không cho từ quá ngắn/dài bất thường.
   */
  if (
    parts.some(
      (part) =>
        part.length <
          MIN_WORD_LENGTH ||
        part.length >
          MAX_WORD_LENGTH,
    )
  ) {
    return false;
  }

  return true;
}

/**
 * =========================================================
 * LOAD SOURCE
 * =========================================================
 */

function loadSourceWords() {
  if (
    !fs.existsSync(
      SOURCE_PATH,
    )
  ) {
    console.error(
      '\n❌ Không tìm thấy file nguồn:',
    );

    console.error(
      SOURCE_PATH,
    );

    console.error(
      '\nHãy tạo file:',
    );

    console.error(
      'src/data/vietnamese_words_source.txt',
    );

    process.exit(1);
  }

  const raw =
    fs.readFileSync(
      SOURCE_PATH,
      'utf8',
    );

  return raw
    .split(/\r?\n/)
    .map(
      normalizeWord,
    )
    .filter(Boolean);
}

/**
 * =========================================================
 * BUILD DICTIONARY
 * =========================================================
 */

function buildDictionary(
  sourceWords,
) {
  const dictionary =
    new Set();

  let invalidCount = 0;

  for (
    const word of sourceWords
  ) {
    if (
      !isValidTwoSyllableWord(
        word,
      )
    ) {
      invalidCount += 1;
      continue;
    }

    dictionary.add(
      word,
    );
  }

  return {
    dictionary:
      Array.from(
        dictionary,
      ).sort(
        (a, b) =>
          a.localeCompare(
            b,
            'vi',
          ),
      ),

    invalidCount,
  };
}

/**
 * =========================================================
 * SAVE
 * =========================================================
 */

function saveDictionary(
  dictionary,
) {
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      dictionary,
      null,
      2,
    ),
    'utf8',
  );
}

/**
 * =========================================================
 * MAIN
 * =========================================================
 */

function main() {
  console.log(
    '\n========================================',
  );

  console.log(
    '   VIETNAMESE WORD CHAIN DICTIONARY',
  );

  console.log(
    '========================================\n',
  );

  console.log(
    '📖 Đang đọc nguồn:',
  );

  console.log(
    SOURCE_PATH,
  );

  const sourceWords =
    loadSourceWords();

  console.log(
    `📦 Tổng dòng nguồn: ${sourceWords.length}`,
  );

  const {
    dictionary,
    invalidCount,
  } =
    buildDictionary(
      sourceWords,
    );

  saveDictionary(
    dictionary,
  );

  console.log(
    `✅ Từ hợp lệ: ${dictionary.length}`,
  );

  console.log(
    `🗑️ Bị loại: ${invalidCount}`,
  );

  console.log(
    `💾 Đã ghi: ${OUTPUT_PATH}`,
  );

  console.log(
    '\n========================================',
  );

  console.log(
    '              HOÀN TẤT',
  );

  console.log(
    '========================================\n',
  );
}

main();
