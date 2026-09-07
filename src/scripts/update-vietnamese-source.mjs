import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const OUTPUT_PATH =
  path.join(
    __dirname,
    '../src/data/vietnamese_words_source.txt',
  );

const SOURCE_URL =
  'https://raw.githubusercontent.com/undertheseanlp/dictionary/master/dictionary/words.txt';

/**
 * =========================================================
 * DOWNLOAD UNDER THE SEA DICTIONARY
 * =========================================================
 *
 * Nguồn:
 *
 * undertheseanlp/dictionary
 *
 * words.txt là JSON Lines.
 *
 * Mỗi dòng có dạng:
 *
 * {"text":"học sinh", ...}
 *
 * Script này:
 *
 * 1. tải nguyên source
 * 2. đọc từng dòng
 * 3. lấy field "text"
 * 4. ghi thành:
 *
 * vietnamese_words_source.txt
 *
 * Mỗi từ một dòng.
 *
 * Sau đó buildVietnameseDictionary.js
 * sẽ xử lý phần còn lại.
 */

/**
 * =========================================================
 * MAIN
 * =========================================================
 */

async function main() {
  console.log(
    '\n========================================',
  );

  console.log(
    '   UNDER THE SEA VIETNAMESE DICTIONARY',
  );

  console.log(
    '========================================\n',
  );

  console.log(
    '🌐 Đang tải dictionary:',
  );

  console.log(
    SOURCE_URL,
  );

  const response =
    await fetch(
      SOURCE_URL,
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}`,
    );
  }

  const raw =
    await response.text();

  console.log(
    `📦 Đã tải: ${raw.length.toLocaleString()} bytes`,
  );

  const words =
    new Set();

  let invalidLines = 0;

  for (
    const line of raw.split(/\r?\n/)
  ) {
    const trimmed =
      line.trim();

    if (!trimmed) {
      continue;
    }

    try {
      const data =
        JSON.parse(
          trimmed,
        );

      if (
        typeof data?.text ===
        'string'
      ) {
        const word =
          data.text
            .trim()
            .replace(
              /\s+/g,
              ' ',
            );

        if (word) {
          words.add(
            word,
          );
        }
      } else {
        invalidLines += 1;
      }
    } catch {
      invalidLines += 1;
    }
  }

  const output =
    Array.from(
      words,
    ).join('\n') +
    '\n';

  fs.writeFileSync(
    OUTPUT_PATH,
    output,
    'utf8',
  );

  console.log(
    `📚 Tổng mục từ lấy được: ${words.size.toLocaleString()}`,
  );

  console.log(
    `⚠️ Dòng không đọc được: ${invalidLines.toLocaleString()}`,
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

main().catch(
  (error) => {
    console.error(
      '\n❌ Không thể cập nhật dictionary:',
    );

    console.error(
      error,
    );

    process.exit(1);
  },
);
