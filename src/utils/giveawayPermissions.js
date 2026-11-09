// giveawayPermissions.js

import { TitanBotError, ErrorTypes } from './errorHandler.js';

export const GIVEAWAY_ADMIN_ROLE_ID = '1541303749916754001';

export function isInGuildInteraction(interaction) {
    if (!interaction) {
        return false;
    }

    if (typeof interaction.inGuild === 'function') {
        return Boolean(interaction.inGuild());
    }

    return Boolean(interaction.guildId || interaction.guild);
}

export function buildGiveawayPermissionDeniedMessage(action = 'sử dụng tính năng giveaway này') {
    return `Chỉ thành viên sở hữu role <@&${GIVEAWAY_ADMIN_ROLE_ID}> mới được phép ${action}.`;
}

export function hasGiveawayAdminRole(memberOrInteraction) {
    const member =
        memberOrInteraction && typeof memberOrInteraction === 'object' && 'member' in memberOrInteraction
            ? memberOrInteraction.member
            : memberOrInteraction;

    if (!member) {
        return false;
    }

    const roles = member.roles;
    if (!roles) {
        return false;
    }

    if (typeof roles.cache?.has === 'function' && roles.cache.has(GIVEAWAY_ADMIN_ROLE_ID)) {
        return true;
    }

    if (Array.isArray(member._roles) && member._roles.includes(GIVEAWAY_ADMIN_ROLE_ID)) {
        return true;
    }

    if (Array.isArray(roles) && roles.includes(GIVEAWAY_ADMIN_ROLE_ID)) {
        return true;
    }

    return false;
}

export async function ensureGiveawayAdminAccess(interaction) {
    if (!isInGuildInteraction(interaction)) {
        return false;
    }

    if (hasGiveawayAdminRole(interaction)) {
        return true;
    }

    if (!interaction?.member && interaction?.guild?.members?.fetch && interaction?.user?.id) {
        const fetchedMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        return hasGiveawayAdminRole(fetchedMember);
    }

    return false;
}

export async function assertGiveawayCommandAdmin(interaction, action = 'sử dụng lệnh giveaway này') {
    if (!isInGuildInteraction(interaction)) {
        throw new TitanBotError(
            'Giveaway command used outside guild',
            ErrorTypes.VALIDATION,
            'Lệnh này chỉ có thể sử dụng trong server.',
            { userId: interaction?.user?.id },
        );
    }

    const allowed = await ensureGiveawayAdminAccess(interaction);
    if (!allowed) {
        throw new TitanBotError(
            'User lacks Giveaway Admin role',
            ErrorTypes.PERMISSION,
            buildGiveawayPermissionDeniedMessage(action),
            {
                userId: interaction?.user?.id,
                guildId: interaction?.guildId,
                requiredRoleId: GIVEAWAY_ADMIN_ROLE_ID,
            },
        );
    }
}

