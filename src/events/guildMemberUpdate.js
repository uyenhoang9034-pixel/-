import {
    AuditLogEvent,
    Events,
    PermissionFlagsBits,
} from 'discord.js';

import {
    handleBoostStarted,
    handleBoostEnded,
} from '../services/boost/boostService.js';

import {
    GAME_ROLE_IDS,
} from '../config/gameRoles.js';

import {
    sendGameRoleNotification,
} from '../services/gameRoleService.js';

import {
    logEvent,
    EVENT_TYPES,
} from '../services/loggingService.js';

import {
    logger,
} from '../utils/logger.js';


export default {

    name:
        Events.GuildMemberUpdate,

    once:
        false,


    async execute(
        oldMember,
        newMember,
    ) {
        try {

            if (
                !newMember?.guild
            ) {
                return;
            }


            /**
             * =================================================
             * NICKNAME CHANGE
             * =================================================
             * Chỉ kiểm tra khi oldMember đã có trong cache (không partial)
             * để tránh ghi log nhầm khi thành viên đổi avatar/bio.
             */

            if (
                !oldMember?.partial &&
                oldMember.nickname !==
                newMember.nickname
            ) {
                await logEvent({
                    client:
                        newMember.client,

                    guildId:
                        newMember.guild.id,

                    eventType:
                        EVENT_TYPES.MEMBER_NAME_CHANGE,

                    data: {
                        title:
                            'Nickname changed',

                        lines: [
                            `**User:** ${newMember.user.toString()} (${newMember.user.tag})`,

                            `**ID:** \`${newMember.user.id}\``,

                            `**Before:** ${oldMember.nickname ||
                            '*(no nickname)*'
                            }`,

                            `**After:** ${newMember.nickname ||
                            '*(no nickname)*'
                            }`,
                        ],

                        thumbnail:
                            newMember.user.displayAvatarURL({
                                dynamic:
                                    true,
                            }),

                        userId:
                            newMember.user.id,
                    },
                });
            }


            /**
             * =================================================
             * BOOST DETECTION
             * =================================================
             * Chỉ kiểm tra khi oldMember đã có trong cache (không partial)
             */

            if (!oldMember?.partial) {
                const wasBoosting =
                    Boolean(
                        oldMember.premiumSince,
                    );

                const isBoosting =
                    Boolean(
                        newMember.premiumSince,
                    );


                /**
                 * =================================================
                 * BOOST STARTED
                 * =================================================
                 */

                if (
                    !wasBoosting &&
                    isBoosting
                ) {
                    await handleBoostStarted(
                        newMember,
                    );
                }


                /**
                 * =================================================
                 * BOOST ENDED
                 * =================================================
                 */

                if (
                    wasBoosting &&
                    !isBoosting
                ) {
                    await handleBoostEnded(
                        newMember,
                    );
                }
            }


            /**
             * =================================================
             * GAME ROLE ADDED
             * =================================================
             * Bắt cả trường hợp:
             * 1. Member có trong cache: So sánh trực tiếp roles.cache
             * 2. Member là partial (chưa có trong cache do sweeper RAM):
             *    Kiểm tra Audit Log để xác định chính xác Admin/Mod vừa cấp role,
             *    loại bỏ hoàn toàn trường hợp member chỉ chỉnh sửa hồ sơ/avatar/bio.
             */

            if (
                !newMember.user?.bot
            ) {
                const addedGameRoleIds = [];

                if (!oldMember?.partial) {
                    // TH1: Member có đầy đủ dữ liệu trong cache -> so sánh an toàn 100%
                    const detectedIds = GAME_ROLE_IDS.filter(
                        (roleId) =>
                            !oldMember.roles.cache.has(roleId) &&
                            newMember.roles.cache.has(roleId),
                    );
                    addedGameRoleIds.push(...detectedIds);
                } else {
                    // TH2: Member là partial (chưa được cache roles trước đó).
                    // Nếu newMember có role game, kiểm tra Audit Log để biết chắc chắn
                    // có phải Admin/Mod vừa cấp role hay không (thay vì đổi avatar/bio).
                    const hasGameRoles = GAME_ROLE_IDS.some((roleId) =>
                        newMember.roles.cache.has(roleId),
                    );

                    if (hasGameRoles) {
                        try {
                            const canViewAuditLog =
                                newMember.guild.members.me?.permissions.has(
                                    PermissionFlagsBits.ViewAuditLog,
                                );

                            if (canViewAuditLog) {
                                // Chờ 350ms để Discord kịp lưu entry vào Audit Log
                                await new Promise((resolve) =>
                                    setTimeout(resolve, 350),
                                );

                                const auditLogs =
                                    await newMember.guild.fetchAuditLogs({
                                        type: AuditLogEvent.MemberRoleUpdate,
                                        limit: 6,
                                    });

                                const now = Date.now();

                                for (const entry of auditLogs.entries.values()) {
                                    const targetId =
                                        entry.targetId ??
                                        entry.target?.id;

                                    if (targetId !== newMember.id) {
                                        continue;
                                    }

                                    // Chỉ xét audit log trong 15 giây gần nhất
                                    if (
                                        now - entry.createdTimestamp >
                                        15000
                                    ) {
                                        continue;
                                    }

                                    // Nếu người cấp là bot (qua reaction panel),
                                    // messageReactionAdd đã tự thông báo rồi, bỏ qua
                                    const executorId =
                                        entry.executorId ??
                                        entry.executor?.id;

                                    if (
                                        executorId ===
                                        newMember.client.user?.id
                                    ) {
                                        continue;
                                    }

                                    const roleAddChange =
                                        entry.changes?.find(
                                            (change) =>
                                                change.key === '$add',
                                        );

                                    if (
                                        roleAddChange &&
                                        Array.isArray(roleAddChange.new)
                                    ) {
                                        for (const addedRole of roleAddChange.new) {
                                            const roleId =
                                                typeof addedRole === 'string'
                                                    ? addedRole
                                                    : addedRole?.id;

                                            if (
                                                roleId &&
                                                GAME_ROLE_IDS.includes(roleId) &&
                                                newMember.roles.cache.has(roleId) &&
                                                !addedGameRoleIds.includes(roleId)
                                            ) {
                                                addedGameRoleIds.push(roleId);
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (auditError) {
                            logger.warn(
                                `Could not verify role update from audit logs for ${newMember.user.tag}:`,
                                auditError,
                            );
                        }
                    }
                }

                if (
                    addedGameRoleIds.length > 0
                ) {
                    logger.info(
                        `Detected ${addedGameRoleIds.length} new Game Role(s) for ${newMember.user.tag}: ${addedGameRoleIds.join(', ')}`,
                    );

                    for (const roleId of addedGameRoleIds) {
                        try {
                            await sendGameRoleNotification(
                                newMember,
                                roleId,
                            );
                        } catch (error) {
                            logger.error(
                                `Failed Game Role notification from GuildMemberUpdate: user=${newMember.user.tag}, role=${roleId}`,
                                error,
                            );
                        }
                    }
                }
            }

        } catch (error) {
            logger.error(
                'Error in guildMemberUpdate event:',
                error,
            );
        }
    },
};
