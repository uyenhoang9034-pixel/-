import {
    logger,
} from '../../utils/logger.js';

import {
    getUserLevelData,
} from './leveling.js';

import {
    getUserLevelPrefix,
} from '../../utils/database/keys.js';

import {
    syncHighestLevelRole,
} from './levelRoleService.js';

/**
 * =========================================================
 * GET ALL LEVEL USER IDS
 * =========================================================
 */

async function listLevelUserIds(
    client,
    guildId,
) {
    if (
        !client.db?.list
    ) {
        return [];
    }

    const prefixes = [
        getUserLevelPrefix(
            guildId,
        ),

        `${guildId}:leveling:users:`,
    ];

    const userIds =
        new Set();

    for (
        const prefix
        of prefixes
    ) {
        let keys =
            await client.db
                .list(
                    prefix,
                )
                .catch(
                    () => [],
                );

        if (
            !Array.isArray(
                keys,
            )
        ) {
            keys =
                typeof keys ===
                    'object' &&
                keys !== null
                    ? Object.keys(
                          keys,
                      )
                    : [];
        }

        for (
            const key
            of keys
        ) {
            if (
                !key.startsWith(
                    prefix,
                )
            ) {
                continue;
            }

            const userId =
                key.slice(
                    prefix.length,
                );

            if (
                /^\d{17,20}$/.test(
                    userId,
                )
            ) {
                userIds.add(
                    userId,
                );
            }
        }
    }

    return [
        ...userIds,
    ];
}

/**
 * =========================================================
 * RECONCILE LEVEL ROLES
 * =========================================================
 *
 * HỆ THỐNG USAGI:
 *
 * Chỉ giữ DUY NHẤT role cảnh giới
 * cao nhất tương ứng với level.
 *
 * Ví dụ:
 *
 * Lv.1
 * -> Luyện Khí
 *
 * Lv.10
 * -> bỏ Luyện Khí
 * -> thêm Trúc Cơ
 *
 * Lv.20
 * -> bỏ Trúc Cơ
 * -> thêm Kim Đan
 *
 * Lv.999
 * -> chỉ giữ Chân Tiên
 *
 * Hàm này chạy khi bot Ready để
 * tự sửa role nếu trước đó bị lệch.
 * =========================================================
 */

export async function reconcileLevelRoles(
    client,
    guildId = null,
) {
    const summary = {
        scannedGuilds:
            0,

        prunedRewardEntries:
            0,

        rolesReAwarded:
            0,

        errors:
            0,
    };

    const guilds =
        guildId
            ? [
                  client.guilds.cache
                      .get(
                          guildId,
                      ),
              ].filter(
                  Boolean,
              )
            : [
                  ...client.guilds.cache
                      .values(),
              ];

    for (
        const guild
        of guilds
    ) {
        summary.scannedGuilds +=
            1;

        try {
            const userIds =
                await listLevelUserIds(
                    client,
                    guild.id,
                );

            for (
                const userId
                of userIds
            ) {
                try {
                    const levelData =
                        await getUserLevelData(
                            client,
                            guild.id,
                            userId,
                        );

                    const member =
                        await guild.members
                            .fetch(
                                userId,
                            )
                            .catch(
                                () =>
                                    null,
                            );

                    if (
                        !member
                    ) {
                        continue;
                    }

                    const result =
                        await syncHighestLevelRole(
                            member,
                            levelData.level,
                        );

                    /**
                     * Không phụ thuộc hoàn toàn
                     * vào kiểu return của service.
                     *
                     * Nếu sync thành công thì
                     * coi như đã reconcile member.
                     */

                    if (
                        result !==
                        false
                    ) {
                        summary.rolesReAwarded +=
                            1;
                    }
                } catch (
                    userError
                ) {
                    summary.errors +=
                        1;

                    logger.warn(
                        `Could not reconcile level role for ${userId} in guild ${guild.id}:`,
                        userError
                            ?.message ||
                            userError,
                    );
                }
            }
        } catch (
            error
        ) {
            summary.errors +=
                1;

            logger.warn(
                `Level role sync failed for guild ${guild.id}:`,
                error
                    ?.message ||
                    error,
            );
        }
    }

    return summary;
}
