export const JTC_NAME_PREFIX = '𓂃⋆';
export const DISCORD_CHANNEL_NAME_MAX_LENGTH = 100;
export const JTC_NAME_SUFFIX_MAX_LENGTH =
  DISCORD_CHANNEL_NAME_MAX_LENGTH - JTC_NAME_PREFIX.length;
export const DEFAULT_JTC_NAME_TEMPLATE = `${JTC_NAME_PREFIX}{username}'s Room`;
export const LEGACY_DEFAULT_JTC_TEMPLATES = new Set([
  "{username}'s Room",
  '{username}',
]);

const CONTROL_AND_INVISIBLE_CHARS_REGEX = /[\x00-\x1F\x7F\u200B-\u200D\uFEFF]/g;
const LEADING_JTC_PREFIX_REGEX = /^(?:\s*𓂃⋆\s*)+/u;
const TEMPLATE_PLACEHOLDER_REGEX =
  /\{(?:username|userTag|user_tag|displayName|display_name|guildName|guild_name|channelName|channel_name)\}/;

export function clampUtf16Safe(text, maxLength = DISCORD_CHANNEL_NAME_MAX_LENGTH) {
  const value = String(text ?? '');
  if (maxLength <= 0) {
    return '';
  }

  let output = '';
  for (const codePoint of value) {
    if (output.length + codePoint.length > maxLength) {
      break;
    }
    output += codePoint;
  }

  return output;
}

export function normalizeVoiceText(rawText) {
  if (rawText === null || rawText === undefined) {
    return '';
  }

  return String(rawText)
    .replace(/[\r\n\t]/g, ' ')
    .replace(CONTROL_AND_INVISIBLE_CHARS_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractVoiceChannelSuffix(rawName) {
  const normalized = normalizeVoiceText(rawName);
  if (!normalized) {
    return '';
  }

  const withoutPrefix = normalized
    .replace(LEADING_JTC_PREFIX_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!withoutPrefix) {
    return '';
  }

  return clampUtf16Safe(withoutPrefix, JTC_NAME_SUFFIX_MAX_LENGTH).trim();
}

export function buildPrefixedVoiceChannelName(
  rawName,
  fallbackSuffix = 'Voice Room',
) {
  const primarySuffix = extractVoiceChannelSuffix(rawName);
  if (primarySuffix) {
    return `${JTC_NAME_PREFIX}${primarySuffix}`;
  }

  const fallback = extractVoiceChannelSuffix(fallbackSuffix) || 'Voice Room';
  return `${JTC_NAME_PREFIX}${fallback}`;
}

export function buildRequiredVoiceChannelName(rawInput) {
  const suffix = extractVoiceChannelSuffix(rawInput);
  if (!suffix) {
    return {
      ok: false,
      suffix: '',
      fullName: null,
    };
  }

  return {
    ok: true,
    suffix,
    fullName: `${JTC_NAME_PREFIX}${suffix}`,
  };
}

export function resolveJtcNameTemplate(rawTemplate) {
  const trimmed =
    typeof rawTemplate === 'string' ? rawTemplate.trim() : '';

  if (!trimmed || LEGACY_DEFAULT_JTC_TEMPLATES.has(trimmed)) {
    return DEFAULT_JTC_NAME_TEMPLATE;
  }

  return trimmed;
}

export function formatJtcChannelName(template, variables = {}) {
  const safeTemplate =
    normalizeVoiceText(template) || DEFAULT_JTC_NAME_TEMPLATE;

  const sanitizeVariable = (value, fallback) => {
    const cleaned = normalizeVoiceText(value).replace(/[@#:`]/g, '').trim();
    return clampUtf16Safe(cleaned, 32).trim() || fallback;
  };

  const username = sanitizeVariable(variables.username, 'User');
  const userTag = sanitizeVariable(variables.userTag, username);
  const displayName = sanitizeVariable(variables.displayName, username);
  const guildName = sanitizeVariable(variables.guildName, 'Server');
  const channelName = sanitizeVariable(
    variables.channelName,
    'Voice Channel',
  );

  const replacements = {
    '{username}': username,
    '{userTag}': userTag,
    '{user_tag}': userTag,
    '{displayName}': displayName,
    '{display_name}': displayName,
    '{guildName}': guildName,
    '{guild_name}': guildName,
    '{channelName}': channelName,
    '{channel_name}': channelName,
  };

  let formatted = safeTemplate;
  for (const [placeholder, value] of Object.entries(replacements)) {
    formatted = formatted.replaceAll(placeholder, value);
  }

  formatted = normalizeVoiceText(formatted).replace(/[@#:`]/g, '').trim();
  if (!formatted) {
    formatted = `${JTC_NAME_PREFIX}${username}'s Room`;
  }

  return clampUtf16Safe(formatted, DISCORD_CHANNEL_NAME_MAX_LENGTH).trim();
}

export function resolveTemporaryVoiceChannelName({
  savedRoomName = null,
  nameTemplate = DEFAULT_JTC_NAME_TEMPLATE,
  variables = {},
  triggerChannelName = 'Voice Channel',
  existingChannelsCount = 0,
} = {}) {
  const rawNameBase =
    normalizeVoiceText(variables.username) ||
    normalizeVoiceText(variables.displayName) ||
    'user';
  const fallbackSuffix = `${rawNameBase}'s Room`;

  if (extractVoiceChannelSuffix(savedRoomName)) {
    return buildPrefixedVoiceChannelName(savedRoomName, fallbackSuffix);
  }

  const effectiveTemplate = resolveJtcNameTemplate(nameTemplate);
  if (TEMPLATE_PLACEHOLDER_REGEX.test(effectiveTemplate)) {
    const formatted = formatJtcChannelName(effectiveTemplate, {
      ...variables,
      channelName: variables.channelName || triggerChannelName,
    });
    return buildPrefixedVoiceChannelName(formatted, fallbackSuffix);
  }

  const staticBase =
    extractVoiceChannelSuffix(
      formatJtcChannelName(effectiveTemplate, {
        ...variables,
        channelName: variables.channelName || triggerChannelName,
      }),
    ) ||
    extractVoiceChannelSuffix(triggerChannelName) ||
    fallbackSuffix;

  const numberedSuffix = `${staticBase} ${Number(existingChannelsCount || 0) + 1}`;
  return buildPrefixedVoiceChannelName(numberedSuffix, fallbackSuffix);
}

export default {
  JTC_NAME_PREFIX,
  DISCORD_CHANNEL_NAME_MAX_LENGTH,
  JTC_NAME_SUFFIX_MAX_LENGTH,
  DEFAULT_JTC_NAME_TEMPLATE,
  LEGACY_DEFAULT_JTC_TEMPLATES,
  clampUtf16Safe,
  normalizeVoiceText,
  extractVoiceChannelSuffix,
  buildPrefixedVoiceChannelName,
  buildRequiredVoiceChannelName,
  resolveJtcNameTemplate,
  formatJtcChannelName,
  resolveTemporaryVoiceChannelName,
};

