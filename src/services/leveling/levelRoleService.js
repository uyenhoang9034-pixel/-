import {
    LEVEL_REWARD_ROLE_IDS,
    getHighestMilestone,
} from '../../config/leveling/levelingSystem.js';

import {
    logger,
} from '../../utils/logger.js';

/**
 * =========================================================
 * SYNC HIGHEST LEVEL ROLE
 * =========================================================
 */

export async function syncHighestLevelRole(
    member,
    level,
) {
    if (
        !member ||
        member.user?.bot
    ) {
        return null;
    }

    const milestone =
        getHighestMilestone(
            level,
        );

    const desiredRoleId =
        milestone?.roleId ||
        null;

    /**
     * =====================================================
     * REMOVE OLD LEVEL ROLES
     * =====================================================
     */

    const rolesToRemove =
        LEVEL_REWARD_ROLE_IDS
            .filter(
                roleId =>
                    roleId !==
                        desiredRoleId &&
                    member.roles.cache.has(
                        roleId,
                    ),
            );

    if (
        rolesToRemove.length >
        0
    ) {
        await member.roles
            .remove(
                rolesToRemove,
                `Sync level role for Lv.${level}`,
            )
            .catch(
                error => {
                    logger.warn(
                        `Failed removing old level roles from ${member.id}:`,
                        error,
                    );
                },
            );
    }

    /**
     * Level 0 hoặc chưa đạt Lv.1.
     */
    if (
        !desiredRoleId
    ) {
        return null;
    }

    if (
        member.roles.cache.has(
            desiredRoleId,
        )
    ) {
        return milestone;
    }

    const role =
        member.guild.roles.cache.get(
            desiredRoleId,
        ) ||
        await member.guild.roles
            .fetch(
                desiredRoleId,
            )
            .catch(
                () => null,
            );

    if (!role) {
        logger.warn(
            `Level role ${desiredRoleId} not found for Lv.${milestone.level}`,
        );

        return milestone;
    }

    await member.roles
        .add(
            role,
            `Reached Lv.${level}`,
        )
        .catch(
            error => {
                logger.warn(
                    `Failed adding level role ${desiredRoleId} to ${member.id}:`,
                    error,
                );
            },
        );

    return milestone;
}
