import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QUOTES_FILE_PATH = path.join(__dirname, '../../data/quotes.txt');

// In-memory cache for fast random access
let quotesCache = [];

// Rate limiter / cooldown per user (1.5 seconds) to prevent spamming
const COOLDOWN_MS = 1500;
const userCooldowns = new Map();

/**
 * Phân tích nội dung file quotes.txt thành danh sách các quote.
 * Quy ước:
 * - Mỗi câu quote được phân cách bằng một hoặc nhiều dòng trống (Enter 2 lần).
 * - Hỗ trợ quote nhiều dòng (ví dụ tiếng Trung + tiếng dịch tiếng Việt).
 * - Bỏ qua các dòng bắt đầu bằng dấu '#' (ghi chú).
 */
export function parseQuotes(content) {
  if (typeof content !== 'string') return [];

  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  // Tách theo block cách nhau bởi dòng trống
  const blocks = normalized.split(/\n\s*\n+/);

  return blocks
    .map((block) => {
      // Lọc bỏ các dòng comment '#' bên trong block
      const cleanLines = block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
      return cleanLines.join('\n');
    })
    .filter((quote) => quote.length > 0);
}

/**
 * Đọc file quotes.txt và nạp vào bộ nhớ RAM
 */
export function loadQuotes() {
  try {
    if (!fs.existsSync(QUOTES_FILE_PATH)) {
      logger.warn(`[QuoteService] File quotes không tồn tại tại: ${QUOTES_FILE_PATH}`);
      quotesCache = [];
      return 0;
    }

    const content = fs.readFileSync(QUOTES_FILE_PATH, 'utf-8');
    quotesCache = parseQuotes(content);
    logger.info(`[QuoteService] Đã tải thành công ${quotesCache.length} câu quote vào bộ nhớ.`);
    return quotesCache.length;
  } catch (error) {
    logger.error('[QuoteService] Lỗi khi nạp file quotes.txt:', error);
    quotesCache = [];
    return 0;
  }
}

/**
 * Tải lại bể quote từ ổ đĩa (Hot-reload)
 */
export function reloadQuotes() {
  return loadQuotes();
}

/**
 * Lấy ngẫu nhiên 1 câu quote từ bể
 */
export function getRandomQuote() {
  if (quotesCache.length === 0) {
    loadQuotes();
  }

  if (quotesCache.length === 0) {
    return {
      quote: '🐰 Bể quote hiện đang trống! Hãy thêm câu mới vào `src/data/quotes.txt` nha~',
      total: 0,
      index: 0,
    };
  }

  const index = Math.floor(Math.random() * quotesCache.length);
  return {
    quote: quotesCache[index],
    total: quotesCache.length,
    index: index + 1,
  };
}

/**
 * Lấy tổng số lượng câu quote hiện có
 */
export function getQuoteCount() {
  return quotesCache.length;
}

/**
 * Xử lý khi có tin nhắn gõ "quote" hoặc "quotes"
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Client} client
 * @returns {Promise<boolean>} Trả về true nếu đã xử lý, false nếu không phải lệnh quote
 */
export async function handleQuoteTrigger(message, client) {
  try {
    if (!message || typeof message.content !== 'string' || !message.guild) {
      return false;
    }

    const normalizedContent = message.content.trim().toLowerCase();

    // Kích hoạt khi tin nhắn là "quote" hoặc "quotes"
    if (normalizedContent !== 'quote' && normalizedContent !== 'quotes') {
      return false;
    }

    // Kiểm tra cooldown chống spam (1.5s/người)
    const userId = message.author.id;
    const now = Date.now();
    const lastUsed = userCooldowns.get(userId) || 0;
    if (now - lastUsed < COOLDOWN_MS) {
      // Bỏ qua trong thời gian cooldown để tránh spam
      return true;
    }
    userCooldowns.set(userId, now);

    // Dọn dẹp map cooldown nếu quá lớn
    if (userCooldowns.size > 2000) {
      const expiry = now - 10000;
      for (const [id, timestamp] of userCooldowns.entries()) {
        if (timestamp < expiry) userCooldowns.delete(id);
      }
    }

    const { quote, total } = getRandomQuote();

    const embed = new EmbedBuilder()
      .setColor('#FFB7D5') // Màu hồng tai thỏ Usagi múp rụp pastel
      .setAuthor({
        name: '🐰 Usagi Quotes',
        iconURL: client.user?.displayAvatarURL?.({ dynamic: true }) || undefined,
      })
      .setDescription(quote)
      .setFooter({
        text: `Gõ "quote" để nhận thêm câu mới nha 🌸 (${total} câu trong bể)`,
        iconURL: message.author.displayAvatarURL?.({ dynamic: true }) || undefined,
      });

    await message.reply({
      content: `${message.author}`,
      embeds: [embed],
      allowedMentions: { repliedUser: true }, // @tag người đó trực tiếp
    });

    return true;
  } catch (error) {
    logger.error('[QuoteService] Lỗi khi phản hồi quote:', error);
    return false;
  }
}

// Khởi chạy nạp quote lần đầu khi module được import
loadQuotes();
