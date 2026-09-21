import { PRISON_ROLE_ID } from '../config/leveling/levelingSystem.js';

export const PRISON_CHANNEL_ID = '1551468471043493920';

const keyFor = (guildId, userId) => `guild:${guildId}:prison:${userId}`;

export async function getPrisonRecord(client, guildId, userId) {
  if (!client?.db?.get) return null;
  return (await client.db.get(keyFor(guildId, userId), null)) || null;
}

async function savePrisonRecord(client, guildId, userId, data) {
  if (!client?.db?.set) throw new Error('Database client is unavailable.');
  await client.db.set(keyFor(guildId, userId), data);
  return data;
}

export async function jailMember(client, member, { laborRequired, reason, moderatorId }) {
  const guild = member.guild;
  const existing = await getPrisonRecord(client, guild.id, member.id);
  const botMember = guild.members.me || await guild.members.fetchMe();

  if (!botMember.permissions.has('ManageRoles')) {
    throw new Error('Bot cần quyền Manage Roles để phạt tù.');
  }

  const removableRoles = member.roles.cache.filter(role =>
    role.id !== guild.id &&
    role.id !== PRISON_ROLE_ID &&
    !role.managed &&
    role.position < botMember.roles.highest.position
  );

  const originalRoleIds = existing?.active
    ? existing.originalRoleIds || []
    : [...removableRoles.keys()];

  if (!existing?.active) {
    const keepRoleIds = [guild.id, PRISON_ROLE_ID];

    for (const role of member.roles.cache.values()) {
      if (keepRoleIds.includes(role.id) || role.managed) continue;

      if (role.position >= botMember.roles.highest.position) {
        throw new Error(
          `Không thể phạt tù vì bot không thể xóa role "${role.name}" (${role.id}). Hãy đặt role bot cao hơn role này.`,
        );
      }
    }

    if (removableRoles.size > 0) {
      await member.roles.remove([...removableRoles.keys()], 'Usagi Prison: phạt tù');
    }
  }

  if (!member.roles.cache.has(PRISON_ROLE_ID)) {
    await member.roles.add(PRISON_ROLE_ID, 'Usagi Prison: vào tù');
  }

  const added = Math.max(1, Math.floor(Number(laborRequired) || 1));
  const totalLabor = existing?.active ? Number(existing.totalLabor || 0) + added : added;
  const remainingLabor = existing?.active ? Number(existing.remainingLabor || 0) + added : added;

  return savePrisonRecord(client, guild.id, member.id, {
    active: true,
    userId: member.id,
    guildId: guild.id,
    originalRoleIds,
    totalLabor,
    remainingLabor,
    completedLabor: Math.max(0, totalLabor - remainingLabor),
    reason: String(reason || 'Không có lý do'),
    moderatorId,
    jailedAt: existing?.jailedAt || Date.now(),
    updatedAt: Date.now(),
  });
}

export async function releaseMember(client, member, record) {
  const guild = member.guild;
  const botMember = guild.members.me || await guild.members.fetchMe();

  if (member.roles.cache.has(PRISON_ROLE_ID)) {
    await member.roles.remove(PRISON_ROLE_ID, 'Usagi Prison: mãn hạn tù');
  }

  const restorable = (record.originalRoleIds || [])
    .map(id => guild.roles.cache.get(id))
    .filter(role =>
      role &&
      role.id !== guild.id &&
      role.id !== PRISON_ROLE_ID &&
      !role.managed &&
      role.position < botMember.roles.highest.position
    )
    .map(role => role.id);

  if (restorable.length > 0) {
    await member.roles.add(restorable, 'Usagi Prison: khôi phục role sau mãn hạn');
  }

  const released = {
    ...record,
    active: false,
    remainingLabor: 0,
    completedLabor: Number(record.totalLabor || 0),
    releasedAt: Date.now(),
    updatedAt: Date.now(),
  };
  await savePrisonRecord(client, guild.id, member.id, released);
  return released;
}

export async function performLabor(client, member) {
  const record = await getPrisonRecord(client, member.guild.id, member.id);
  if (!record?.active) return { status: 'not_prisoner', record: null };

  const remaining = Math.max(0, Number(record.remainingLabor || 0) - 1);
  const total = Math.max(1, Number(record.totalLabor || 1));
  const next = {
    ...record,
    remainingLabor: remaining,
    completedLabor: total - remaining,
    updatedAt: Date.now(),
  };

  if (remaining === 0) {
    const released = await releaseMember(client, member, next);
    return { status: 'released', record: released };
  }

  await savePrisonRecord(client, member.guild.id, member.id, next);
  return { status: remaining === 1 ? 'last_one' : 'progress', record: next };
}

export function progressBar(completed, total) {
  const safeTotal = Math.max(1, Number(total || 1));
  const safeCompleted = Math.min(safeTotal, Math.max(0, Number(completed || 0)));
  const percent = Math.round((safeCompleted / safeTotal) * 100);
  const slots = 10;
  const filled = Math.round((safeCompleted / safeTotal) * slots);
  return `${'█'.repeat(filled)}${'░'.repeat(slots - filled)} ${percent}%`;
}
