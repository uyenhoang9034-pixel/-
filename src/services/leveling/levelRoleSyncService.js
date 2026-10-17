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
            /**
             * =============================================
             * LAZY RECONCILIATION
             * =============================================
             *
             * Chỉ kiểm tra và sync role cho các member
             * đang có sẵn trong cache (voice / active).
             *
             * TUYỆT ĐỐI KHÔNG fetch hàng loạt hàng nghìn user
             * offline từ database khi boot để tránh:
             * - Spike RAM làm sập ngưỡng 384MB
             * - Nghẽn rate limit của Discord REST API
             *
             * Các user offline khi hoạt động trở lại (chat, voice)
             * sẽ tự động được sync role khi nhận XP hoặc lên cấp.
             */
            for (
                const member
                of guild.members.cache.values()
            ) {
                if (
                    member.user?.bot
                ) {
                    continue;
                }

                try {
                    const levelData =
                        await getUserLevelData(
                            client,
                            guild.id,
                            member.id,
                        );

                    if (
                        !levelData ||
                        !levelData.level
                    ) {
                        continue;
                    }

                    const result =
                        await syncHighestLevelRole(
                            member,
                            levelData.level,
                        );

                    /**
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
                        `Could not reconcile level role for ${member.id} in guild ${guild.id}:`,
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
