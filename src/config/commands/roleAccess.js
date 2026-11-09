// roleAccess.js

import { isBotOwner } from '../bot.js';

export const ROLE_IDS = Object.freeze({
  TOP_ADMIN: '1541303749916754001',
  MID_ADMIN: '1545305594712432640',
  STAFF_TICKET: '1545295139390619768',
  DONOR: '1568129166979764244',
});

export const ROLE_TIERS = Object.freeze({
  EVERYONE: 0,
  STAFF_TICKET: 1,
  MID_ADMIN: 2,
  TOP_ADMIN: 3,
});

export const TIER_NAMES = Object.freeze({
  [ROLE_TIERS.EVERYONE]: 'EVERYONE',
  [ROLE_TIERS.STAFF_TICKET]: 'STAFF_TICKET',
  [ROLE_TIERS.MID_ADMIN]: 'MID_ADMIN',
  [ROLE_TIERS.TOP_ADMIN]: 'TOP_ADMIN',
});

export const COMMAND_MIN_TIER = Object.freeze({
  // Tier 0: Everyone (18 commands)
  audio: ROLE_TIERS.EVERYONE,
  calculate: ROLE_TIERS.EVERYONE,
  shorten: ROLE_TIERS.EVERYONE,
  avatar: ROLE_TIERS.EVERYONE,
  userinfo: ROLE_TIERS.EVERYONE,
  serverinfo: ROLE_TIERS.EVERYONE,
  tracuu: ROLE_TIERS.EVERYONE,
  leaderboard: ROLE_TIERS.EVERYONE,
  'bxh-bingo': ROLE_TIERS.EVERYONE,
  diengiaicoche: ROLE_TIERS.EVERYONE,
  'nhiem-vu': ROLE_TIERS.EVERYONE,
  bet: ROLE_TIERS.EVERYONE,
  profile: ROLE_TIERS.EVERYONE,
  supporter: ROLE_TIERS.EVERYONE,
  vukhi: ROLE_TIERS.EVERYONE,
  birthday: ROLE_TIERS.EVERYONE,
  noitu: ROLE_TIERS.EVERYONE,
  duel: ROLE_TIERS.EVERYONE,

  // Tier 1: Support Ticket + Mid Admin + Top Admin (9 commands)
  ticket: ROLE_TIERS.STAFF_TICKET,
  claim: ROLE_TIERS.STAFF_TICKET,
  close: ROLE_TIERS.STAFF_TICKET,
  transcript: ROLE_TIERS.STAFF_TICKET,
  confession: ROLE_TIERS.STAFF_TICKET,
  setnick: ROLE_TIERS.STAFF_TICKET,
  say: ROLE_TIERS.STAFF_TICKET,
  say2: ROLE_TIERS.STAFF_TICKET,
  autoresponder: ROLE_TIERS.STAFF_TICKET,

  // Tier 2: Mid Admin + Top Admin (23 commands)
  'birthday-admin': ROLE_TIERS.MID_ADMIN,
  'noitu-admin': ROLE_TIERS.MID_ADMIN,
  ban: ROLE_TIERS.MID_ADMIN,
  unban: ROLE_TIERS.MID_ADMIN,
  testban: ROLE_TIERS.MID_ADMIN,
  kick: ROLE_TIERS.MID_ADMIN,
  warn: ROLE_TIERS.MID_ADMIN,
  warnings: ROLE_TIERS.MID_ADMIN,
  testwarn: ROLE_TIERS.MID_ADMIN,
  cases: ROLE_TIERS.MID_ADMIN,
  clear: ROLE_TIERS.MID_ADMIN,
  lock: ROLE_TIERS.MID_ADMIN,
  dm: ROLE_TIERS.MID_ADMIN,
  dm2: ROLE_TIERS.MID_ADMIN,
  autoreact: ROLE_TIERS.MID_ADMIN,
  privateverify: ROLE_TIERS.MID_ADMIN,
  'setup-role-icon-shop': ROLE_TIERS.MID_ADMIN,
  reactroles: ROLE_TIERS.MID_ADMIN,
  boost: ROLE_TIERS.MID_ADMIN,
  welcome: ROLE_TIERS.MID_ADMIN,
  goodbye: ROLE_TIERS.MID_ADMIN,
  greet: ROLE_TIERS.MID_ADMIN,
  level: ROLE_TIERS.MID_ADMIN,

  // Tier 3: Top Admin / Server Owner (46 commands)
  help: ROLE_TIERS.TOP_ADMIN,
  ping: ROLE_TIERS.TOP_ADMIN,
  stats: ROLE_TIERS.TOP_ADMIN,
  support: ROLE_TIERS.TOP_ADMIN,
  wipedata: ROLE_TIERS.TOP_ADMIN,
  monolith: ROLE_TIERS.TOP_ADMIN,
  'duel-admin': ROLE_TIERS.TOP_ADMIN,
  'giai-ma': ROLE_TIERS.TOP_ADMIN,
  'setup-giai-ma': ROLE_TIERS.TOP_ADMIN,
  bxhdonate: ROLE_TIERS.TOP_ADMIN,
  xuatbaocao: ROLE_TIERS.TOP_ADMIN,
  setnickpanel: ROLE_TIERS.TOP_ADMIN,
  gannounce: ROLE_TIERS.TOP_ADMIN,
  gblacklist: ROLE_TIERS.TOP_ADMIN,
  gcreate: ROLE_TIERS.TOP_ADMIN,
  gdashboard: ROLE_TIERS.TOP_ADMIN,
  gdelay: ROLE_TIERS.TOP_ADMIN,
  gdelete: ROLE_TIERS.TOP_ADMIN,
  gend: ROLE_TIERS.TOP_ADMIN,
  gparticipants: ROLE_TIERS.TOP_ADMIN,
  gpumpkin: ROLE_TIERS.TOP_ADMIN,
  gremoveparticipant: ROLE_TIERS.TOP_ADMIN,
  greroll: ROLE_TIERS.TOP_ADMIN,
  gselect: ROLE_TIERS.TOP_ADMIN,
  'wh-admin': ROLE_TIERS.TOP_ADMIN,
  'chot-bxh': ROLE_TIERS.TOP_ADMIN,
  'preview-bxh': ROLE_TIERS.TOP_ADMIN,
  'doi-phe': ROLE_TIERS.TOP_ADMIN,
  'phat-bi-ngo': ROLE_TIERS.TOP_ADMIN,
  'thu-hoi-bi-ngo': ROLE_TIERS.TOP_ADMIN,
  'phat-manh-vo-ky-uc': ROLE_TIERS.TOP_ADMIN,
  'reset-witch-hunter': ROLE_TIERS.TOP_ADMIN,
  'setup-chon-phe': ROLE_TIERS.TOP_ADMIN,
  'setup-summon': ROLE_TIERS.TOP_ADMIN,
  'setup-expedition': ROLE_TIERS.TOP_ADMIN,
  'setup-black-market': ROLE_TIERS.TOP_ADMIN,
  'setup-thap-nen': ROLE_TIERS.TOP_ADMIN,
  channelguide: ROLE_TIERS.TOP_ADMIN,
  levelresetall: ROLE_TIERS.TOP_ADMIN,
  commands: ROLE_TIERS.TOP_ADMIN,
  jointocreate: ROLE_TIERS.TOP_ADMIN,
  autorole: ROLE_TIERS.TOP_ADMIN,
  leveladd: ROLE_TIERS.TOP_ADMIN,
  levelremove: ROLE_TIERS.TOP_ADMIN,
  levelset: ROLE_TIERS.TOP_ADMIN,
  leveltest: ROLE_TIERS.TOP_ADMIN,
});

export const PREFIX_ONLY_ACCESS = Object.freeze({
  donate: 'EVERYONE',
  roleicon: 'DONOR_OR_OWNER',
  quyenloi: 'MID_ADMIN',
  add: 'FINANCIAL_ADMIN',
  addquychung: 'FINANCIAL_ADMIN',
  trutien: 'FINANCIAL_ADMIN',
});

export function hasRole(member, roleId, guild = null) {
  if (!member || !roleId) {
    return false;
  }

  const targetRoleId = String(roleId);

  if (typeof member.roles?.cache?.has === 'function' && member.roles.cache.has(targetRoleId)) {
    return true;
  }

  if (Array.isArray(member._roles) && member._roles.some((id) => String(id) === targetRoleId)) {
    return true;
  }

  if (Array.isArray(member.roles) && member.roles.some((id) => String(id) === targetRoleId)) {
    return true;
  }

  const userId = member.id || member.user?.id;
  const cachedMember = userId ? guild?.members?.cache?.get?.(userId) : null;
  if (cachedMember?.roles?.cache?.has?.(targetRoleId)) {
    return true;
  }

  return false;
}

export function isGuildOwnerOrBotOwner(member, guild = null, user = null) {
  const userId = user?.id || member?.user?.id || member?.id;
  if (userId && isBotOwner(userId)) {
    return true;
  }

  const ownerId = guild?.ownerId || member?.guild?.ownerId;
  if (ownerId && userId && String(userId) === String(ownerId)) {
    return true;
  }

  return false;
}

export function resolveRoleTier(tierOrName) {
  if (typeof tierOrName === 'string') {
    const normalized = tierOrName.trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(ROLE_TIERS, normalized)
      ? ROLE_TIERS[normalized]
      : null;
  }

  if (typeof tierOrName === 'number' && Number.isInteger(tierOrName)) {
    return tierOrName;
  }

  return null;
}

export function getMemberHighestTier(member, guild = null, user = null) {
  const resolvedGuild = guild || member?.guild || null;

  if (isGuildOwnerOrBotOwner(member, resolvedGuild, user)) {
    return ROLE_TIERS.TOP_ADMIN;
  }

  if (!member) {
    return ROLE_TIERS.EVERYONE;
  }

  if (hasRole(member, ROLE_IDS.TOP_ADMIN, resolvedGuild)) {
    return ROLE_TIERS.TOP_ADMIN;
  }

  if (hasRole(member, ROLE_IDS.MID_ADMIN, resolvedGuild)) {
    return ROLE_TIERS.MID_ADMIN;
  }

  if (hasRole(member, ROLE_IDS.STAFF_TICKET, resolvedGuild)) {
    return ROLE_TIERS.STAFF_TICKET;
  }

  return ROLE_TIERS.EVERYONE;
}

export function hasRoleTier(member, requiredTier, guild = null, user = null) {
  const minTier = resolveRoleTier(requiredTier);
  if (minTier === null) {
    return false;
  }

  if (minTier <= ROLE_TIERS.EVERYONE) {
    return true;
  }

  const resolvedGuild = guild || member?.guild || null;
  if (isGuildOwnerOrBotOwner(member, resolvedGuild, user)) {
    return true;
  }

  if (!member) {
    return false;
  }

  return getMemberHighestTier(member, resolvedGuild, user) >= minTier;
}

export function getRequiredTierForCommand(commandName) {
  const normalized = String(commandName || '').toLowerCase().trim();
  if (!normalized) {
    return null;
  }

  return Object.prototype.hasOwnProperty.call(COMMAND_MIN_TIER, normalized)
    ? COMMAND_MIN_TIER[normalized]
    : null;
}

export function isMemberAllowedCommand(member, commandName, guild = null, user = null) {
  const requiredTier = getRequiredTierForCommand(commandName);
  if (requiredTier === null) {
    return false;
  }

  return hasRoleTier(member, requiredTier, guild, user);
}

export function getRequiredRoleIdForTier(requiredTier) {
  const minTier = resolveRoleTier(requiredTier);
  if (minTier === ROLE_TIERS.TOP_ADMIN) {
    return ROLE_IDS.TOP_ADMIN;
  }
  if (minTier === ROLE_TIERS.MID_ADMIN) {
    return ROLE_IDS.MID_ADMIN;
  }
  if (minTier === ROLE_TIERS.STAFF_TICKET) {
    return ROLE_IDS.STAFF_TICKET;
  }
  return null;
}

export function buildRoleDeniedMessage(commandName, requiredTier = null) {
  const resolvedTier = requiredTier ?? getRequiredTierForCommand(commandName);
  const roleId = getRequiredRoleIdForTier(resolvedTier);
  const formattedName = commandName ? `\`/${commandName}\`` : 'lệnh này';

  if (resolvedTier === ROLE_TIERS.TOP_ADMIN && roleId) {
    return `Chỉ role <@&${roleId}> hoặc Chủ Server mới có quyền sử dụng ${formattedName}.`;
  }

  if (roleId) {
    return `Chỉ role <@&${roleId}> (hoặc cấp quản trị cao hơn) mới có quyền sử dụng ${formattedName}.`;
  }

  return `Bạn không có quyền sử dụng ${formattedName}.`;
}

