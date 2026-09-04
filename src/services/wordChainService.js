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
    const dictPath = path.join(__dirname, '../data/vietnamese_words.json');
    if (fs.existsSync(dictPath)) {
      const rawData = fs.readFileSync(dictPath, 'utf8');
      const words = JSON.parse(rawData);

      validWordsSet = new Set();
      startWordMap = new Map();

      for (const word of words) {
        const cleaned = word.trim().toLowerCase();
        validWordsSet.add(cleaned);

        const parts = cleaned.split(/\s+/);
        if (parts.length === 2) {
          const first = parts[0];
          if (!startWordMap.has(first)) {
            startWordMap.set(first, []);
          }
          startWordMap.get(first).push(cleaned);
        }
      }
      isDictionaryLoaded = true;
      logger.info(`Loaded ${validWordsSet.size} Vietnamese words for Word Chain minigame.`);
    } else {
      logger.warn(`Vietnamese dictionary file not found at ${dictPath}`);
    }
  } catch (error) {
    logger.error('Error loading Vietnamese dictionary:', error);
  }
}

// Ensure dictionary is initialized when module loads
initDictionary();

export const WORD_CHAIN_MODES = {
  pvp: {
    label: 'Người vs Người (PvP)',
    description: 'Các thành viên trong server thay phiên nhau nối từ.',
    value: 'pvp',
  },
  bot: {
    label: 'Đấu với Bot (PvE)',
    description: 'Người chơi nối từ, Bot sẽ tự động tìm từ nối tiếp theo.',
    value: 'bot',
  },
};

const DEFAULT_WORD_CHAIN_CONFIG = {
  enabled: false,
  channelId: null,
  mode: 'bot', // 'pvp' | 'bot'
  currentWord: null,
  lastUserId: null,
  usedWords: [],
  currentStreak: 0,
  bestStreak: 0,
  leaderboard: {},
};

function normalizeWordChainConfig(state) {
  const normalized = {
    ...DEFAULT_WORD_CHAIN_CONFIG,
    ...(state || {}),
  };

  if (!WORD_CHAIN_MODES[normalized.mode]) {
    normalized.mode = 'bot';
  }

  normalized.usedWords = Array.isArray(normalized.usedWords) ? normalized.usedWords : [];
  normalized.leaderboard = normalized.leaderboard && typeof normalized.leaderboard === 'object'
    ? { ...normalized.leaderboard }
    : {};

  return normalized;
}

function getStorageKey(guildId) {
  return `${WORD_CHAIN_KEY_PREFIX}${guildId}`;
}

export async function getWordChainConfig(client, guildId) {
  try {
    const rawState = await client.db.get(getStorageKey(guildId));
    return normalizeWordChainConfig(rawState);
  } catch (error) {
    logger.error('Failed to load word chain config:', { guildId, error });
    return normalizeWordChainConfig();
  }
}

export async function saveWordChainConfig(client, guildId, state) {
  const normalized = normalizeWordChainConfig(state);
  await client.db.set(getStorageKey(guildId), normalized);
  return normalized;
}

export async function activateWordChain(client, guildId, channelId, mode = 'bot', startWord = null) {
  initDictionary();
  const current = await getWordChainConfig(client, guildId);
  const initialWord = startWord && isValidWord(startWord) ? normalizeWord(startWord) : getRandomStartWord();

  const nextState = {
    ...current,
    enabled: true,
    channelId,
    mode: WORD_CHAIN_MODES[mode] ? mode : 'bot',
    currentWord: initialWord,
    lastUserId: null,
    usedWords: initialWord ? [initialWord] : [],
    currentStreak: initialWord ? 1 : 0,
  };

  return saveWordChainConfig(client, guildId, nextState);
}

export async function disableWordChain(client, guildId) {
  const current = await getWordChainConfig(client, guildId);
  return saveWordChainConfig(client, guildId, { ...current, enabled: false });
}

export async function resetWordChainGame(client, guildId, startWord = null) {
  initDictionary();
  const current = await getWordChainConfig(client, guildId);
  const initialWord = startWord && isValidWord(startWord) ? normalizeWord(startWord) : getRandomStartWord();

  const nextState = {
    ...current,
    currentWord: initialWord,
    lastUserId: null,
    usedWords: initialWord ? [initialWord] : [],
    currentStreak: initialWord ? 1 : 0,
  };

  return saveWordChainConfig(client, guildId, nextState);
}

export function normalizeWord(word) {
  if (typeof word !== 'string') return '';
  return word.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isValidWord(word) {
  initDictionary();
  const cleaned = normalizeWord(word);
  const parts = cleaned.split(' ');
  if (parts.length !== 2) {
    return false;
  }
  return validWordsSet.has(cleaned);
}

export function canChain(prevWord, nextWord) {
  if (!prevWord || !nextWord) return true;
  const prevParts = normalizeWord(prevWord).split(' ');
  const nextParts = normalizeWord(nextWord).split(' ');
  if (prevParts.length !== 2 || nextParts.length !== 2) return false;

  return prevParts[1] === nextParts[0];
}

export function getLastSyllable(word) {
  if (!word) return '';
  const parts = normalizeWord(word).split(' ');
  return parts.length === 2 ? parts[1] : '';
}

export function getFirstSyllable(word) {
  if (!word) return '';
  const parts = normalizeWord(word).split(' ');
  return parts.length === 2 ? parts[0] : '';
}

export function findBotNextWord(prevWord, usedWords = []) {
  initDictionary();
  const lastSyllable = getLastSyllable(prevWord);
  if (!lastSyllable) return null;

  const candidates = startWordMap.get(lastSyllable);
  if (!candidates || candidates.length === 0) {
    return null; // Bot chịu thua vì không có từ nào trong từ điển bắt đầu bằng tiếng này
  }

  const usedSet = new Set(usedWords.map(w => normalizeWord(w)));
  const availableCandidates = candidates.filter(w => !usedSet.has(w));

  if (availableCandidates.length === 0) {
    return null; // Tất cả các từ đã được dùng hết
  }

  // Chọn ngẫu nhiên 1 từ hợp lệ
  const randomIndex = Math.floor(Math.random() * availableCandidates.length);
  return availableCandidates[randomIndex];
}

export function getRandomStartWord() {
  initDictionary();
  // Chọn các từ bắt đầu có nhiều từ nối tiếp để mở đầu thuận lợi
  const safeStartWords = [
    'học sinh', 'hoa hồng', 'bình minh', 'mặt trời', 'thời gian',
    'con cá', 'nước biển', 'bầu trời', 'tương lai', 'thành phố',
    'gia đình', 'cuộc sống', 'yêu thương', 'bạn bè', 'ngôi sao'
  ];

  const validStarters = safeStartWords.filter(w => validWordsSet.has(w));
  if (validStarters.length > 0) {
    return validStarters[Math.floor(Math.random() * validStarters.length)];
  }

  // Fallback ngẫu nhiên từ set
  const allWords = Array.from(validWordsSet);
  if (allWords.length > 0) {
    return allWords[Math.floor(Math.random() * allWords.length)];
  }

  return 'học sinh';
}

export async function recordUserSuccess(client, guildId, userId, word) {
  const current = await getWordChainConfig(client, guildId);
  const normalized = normalizeWord(word);
  const leaderboard = { ...current.leaderboard };
  leaderboard[userId] = (leaderboard[userId] || 0) + 1;

  const nextStreak = (current.currentStreak || 0) + 1;
  const nextUsedWords = [...(current.usedWords || []), normalized];

  const updated = {
    ...current,
    currentWord: normalized,
    lastUserId: userId,
    usedWords: nextUsedWords,
    currentStreak: nextStreak,
    bestStreak: Math.max(current.bestStreak || 0, nextStreak),
    leaderboard,
  };

  return saveWordChainConfig(client, guildId, updated);
}

export async function recordBotSuccess(client, guildId, botWord) {
  const current = await getWordChainConfig(client, guildId);
  const normalized = normalizeWord(botWord);
  const nextStreak = (current.currentStreak || 0) + 1;
  const nextUsedWords = [...(current.usedWords || []), normalized];

  const updated = {
    ...current,
    currentWord: normalized,
    lastUserId: client.user.id,
    usedWords: nextUsedWords,
    currentStreak: nextStreak,
    bestStreak: Math.max(current.bestStreak || 0, nextStreak),
  };

  return saveWordChainConfig(client, guildId, updated);
}

export async function recordBreak(client, guildId, newStartWord = null) {
  const current = await getWordChainConfig(client, guildId);
  const initialWord = newStartWord && isValidWord(newStartWord) ? normalizeWord(newStartWord) : getRandomStartWord();

  const nextState = {
    ...current,
    currentWord: initialWord,
    lastUserId: null,
    usedWords: initialWord ? [initialWord] : [],
    currentStreak: initialWord ? 1 : 0,
  };

  return saveWordChainConfig(client, guildId, nextState);
}

export function buildWordChainLeaderboard(config) {
  const entries = Object.entries(config.leaderboard || {})
    .map(([userId, score]) => ({ userId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return entries;
}
