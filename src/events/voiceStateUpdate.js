import {
    ChannelType,
    PermissionFlagsBits,
} from 'discord.js';

import {
    getJoinToCreateConfig,
    registerTemporaryChannel,
    unregisterTemporaryChannel,
    getTemporaryChannelInfo,
    formatChannelName,
} from '../utils/database.js';

import {
    sanitizeInput,
} from '../utils/validation.js';

import {
    logger,
} from '../utils/logger.js';

import {
    handleMusicVoiceState,
} from '../services/music/musicVoiceState.js';

import {
    handleVoiceLevelState,
} from '../services/leveling/voiceLevelService.js';

const channelCreationCooldown =
    new Map();

const VOICE_CREATE_COOLDOWN_MS =
    2000;

const DEFAULT_VOICE_BITRATE =
    64000;

const MAX_VOICE_BITRATE =
    384000;

const MIN_VOICE_BITRATE =
    8000;

const MAX_CHANNEL_NAME_LENGTH =
    100;

const FALLBACK_CHANNEL_NAME =
    'Voice Room';

const MAX_TRACKED_COOLDOWNS =
    10000;

export default {
    name:
        'voiceStateUpdate',

    async execute(
        oldState,
        newState,
        client,
    ) {
        /**
         * =====================================================
         * IGNORE BOT
         * =====================================================
         */

        if (
            newState.member
                ?.user
                ?.bot
        ) {
            return;
        }

        /**
         * =====================================================
         * USAGI VOICE LEVEL
         * =====================================================
         *
         * Chạy độc lập với Join-to-Create.
         *
         * Vì vậy kể cả Join-to-Create bị disable,
         * Voice Level vẫn hoạt động.
         */

        try {
            await handleVoiceLevelState(
                client,
                oldState,
                newState,
            );
        } catch (
            error
        ) {
            logger.error(
                'Voice leveling error:',
                error,
            );
        }

        const guildId =
            newState.guild.id;

        const userId =
            newState.member.id;

        const cooldownKey =
            `${guildId}-${userId}`;

        cleanupCooldownEntries();

        try {
            const config =
                await getJoinToCreateConfig(
                    client,
                    guildId,
                );

            /**
             * =================================================
             * JOIN TO CREATE DISABLED
             * =================================================
             *
             * Chỉ dừng Join-to-Create.
             *
             * Voice Level phía trên đã được
             * xử lý rồi.
             */

            if (
                !config.enabled ||
                config.triggerChannels
                    .length ===
                    0
            ) {
                /**
                 * Music vẫn phải được xử lý.
                 */

                if (
                    client.config
                        ?.features
                        ?.music
                ) {
                    await handleMusicVoiceState(
                        client,
                        oldState,
                        newState,
                    ).catch(
                        error => {
                            logger.error(
                                'Music voice state handler error:',
                                error,
                            );
                        },
                    );
                }

                return;
            }

            /**
             * =================================================
             * JOIN
             * =================================================
             */

            if (
                !oldState.channel &&
                newState.channel
            ) {
                await handleVoiceJoin(
                    client,
                    newState,
                    config,
                );
            }

            /**
             * =================================================
             * LEAVE
             * =================================================
             */

            if (
                oldState.channel &&
                !newState.channel
            ) {
                await handleVoiceLeave(
                    client,
                    oldState,
                    config,
                );
            }

            /**
             * =================================================
             * MOVE
             * =================================================
             */

            if (
                oldState.channel &&
                newState.channel &&
                oldState.channel.id !==
                    newState.channel.id
            ) {
                await handleVoiceMove(
                    client,
                    oldState,
                    newState,
                    config,
                );
            }
        } catch (
            error
        ) {
            logger.error(
                `Error in voiceStateUpdate for guild ${guildId}:`,
                error,
            );
        }

        /**
         * =====================================================
         * HANDLE VOICE JOIN
         * =====================================================
         */

        async function handleVoiceJoin(
            client,
            state,
            config,
        ) {
            const {
                channel,
                member,
            } = state;

            if (
                !config.triggerChannels
                    .includes(
                        channel.id,
                    )
            ) {
                return;
            }

            const now =
                Date.now();

            if (
                channelCreationCooldown
                    .has(
                        cooldownKey,
                    )
            ) {
                const lastCreation =
                    channelCreationCooldown
                        .get(
                            cooldownKey,
                        );

                if (
                    now -
                    lastCreation <
                    VOICE_CREATE_COOLDOWN_MS
                ) {
                    logger.warn(
                        `User ${member.id} is on cooldown for channel creation`,
                    );

                    return;
                }
            }

            /**
             * =================================================
             * EXISTING TEMP ROOM
             * =================================================
             */

            const existingTempChannel =
                Object.keys(
                    config.temporaryChannels ||
                    {},
                ).find(
                    tempChannelId => {
                        const tempInfo =
                            config
                                .temporaryChannels[
                                tempChannelId
                            ];

                        return (
                            tempInfo &&
                            tempInfo.ownerId ===
                                member.id
                        );
                    },
                );

            if (
                existingTempChannel
            ) {
                const tempChannel =
                    state.guild.channels
                        .cache
                        .get(
                            existingTempChannel,
                        );

                if (
                    tempChannel
                ) {
                    try {
                        await member.voice
                            .setChannel(
                                tempChannel,
                            );

                        return;
                    } catch (
                        error
                    ) {
                        logger.warn(
                            `Failed to move user ${member.id} to existing channel ${existingTempChannel}:`,
                            error,
                        );
                    }
                }
            }

            if (
                member.voice
                    .channel?.id !==
                channel.id
            ) {
                return;
            }

            channelCreationCooldown
                .set(
                    cooldownKey,
                    now,
                );

            trimCooldownMapIfNeeded();

            await createTemporaryChannel(
                client,
                state,
                config,
            );
        }

        /**
         * =====================================================
         * HANDLE VOICE LEAVE
         * =====================================================
         */

        async function handleVoiceLeave(
            client,
            state,
            config,
        ) {
            const {
                channel,
                member,
            } = state;

            const tempChannelInfo =
                await getTemporaryChannelInfo(
                    client,
                    state.guild.id,
                    channel.id,
                );

            if (
                !tempChannelInfo
            ) {
                return;
            }

            if (
                channel.members.size ===
                0
            ) {
                await deleteTemporaryChannel(
                    client,
                    channel,
                    state.guild.id,
                );
            } else if (
                tempChannelInfo.ownerId ===
                member.id
            ) {
                const nextMember =
                    channel.members
                        .first();

                if (
                    nextMember
                ) {
                    await transferChannelOwnership(
                        client,
                        channel,
                        state.guild.id,
                        nextMember.id,
                    );
                }
            }
        }

        /**
         * =====================================================
         * HANDLE VOICE MOVE
         * =====================================================
         */

        async function handleVoiceMove(
            client,
            oldState,
            newState,
            config,
        ) {
            if (
                oldState.channel
            ) {
                const tempChannelInfo =
                    await getTemporaryChannelInfo(
                        client,
                        oldState.guild.id,
                        oldState.channel.id,
                    );

                if (
                    tempChannelInfo
                ) {
                    if (
                        oldState.channel
                            .members
                            .size ===
                        0
                    ) {
                        await deleteTemporaryChannel(
                            client,
                            oldState.channel,
                            oldState.guild.id,
                        );
                    } else if (
                        tempChannelInfo.ownerId ===
                        oldState.member.id
                    ) {
                        const nextMember =
                            oldState.channel
                                .members
                                .first();

                        if (
                            nextMember
                        ) {
                            await transferChannelOwnership(
                                client,
                                oldState.channel,
                                oldState.guild.id,
                                nextMember.id,
                            );
                        }
                    }
                }
            }

            if (
                config.triggerChannels
                    .includes(
                        newState.channel.id,
                    ) &&
                !config.triggerChannels
                    .includes(
                        oldState.channel
                            ?.id,
                    )
            ) {
                await handleVoiceJoin(
                    client,
                    newState,
                    config,
                );
            }
        }

        /**
         * =====================================================
         * CREATE TEMPORARY CHANNEL
         * =====================================================
         */

        async function createTemporaryChannel(
            client,
            state,
            config,
        ) {
            const {
                channel:
                    triggerChannel,

                member,
                guild,
            } = state;

            try {
                const me =
                    guild.members.me;

                if (
                    !me
                ) {
                    logger.warn(
                        `Bot member cache unavailable while creating temporary channel in guild ${guild.id}`,
                    );

                    channelCreationCooldown
                        .delete(
                            cooldownKey,
                        );

                    return;
                }

                const triggerPermissions =
                    triggerChannel
                        .permissionsFor(
                            me,
                        );

                if (
                    !triggerPermissions
                        ?.has([
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.Connect,
                        ])
                ) {
                    logger.warn(
                        `Missing required permissions for temporary channel creation in guild ${guild.id} (trigger channel ${triggerChannel.id})`,
                    );

                    channelCreationCooldown
                        .delete(
                            cooldownKey,
                        );

                    return;
                }

                /**
                 * =================================================
                 * SERVER / TRIGGER SETTINGS
                 * =================================================
                 */

                const channelOptions =
                    config
                        .channelOptions?.[
                        triggerChannel.id
                    ] ||
                    {};

                const nameTemplate =
                    channelOptions
                        .nameTemplate ||
                    config
                        .channelNameTemplate ||
                    "{username}'s Room";

                /**
                 * =================================================
                 * USER SAVED PREFERENCES
                 * =================================================
                 */

                const userPreferences =
                    config
                        .userPreferences?.[
                        member.id
                    ] ||
                    {};

                let userLimit =
                    userPreferences
                        .userLimit ??
                    channelOptions
                        .userLimit ??
                    config
                        .userLimit ??
                    0;

                userLimit =
                    Math.max(
                        0,
                        Math.min(
                            99,
                            Number(
                                userLimit,
                            ) ||
                            0,
                        ),
                    );

                const bitrate =
                    clampVoiceBitrate(
                        channelOptions
                            .bitrate ??
                        config
                            .bitrate ??
                        DEFAULT_VOICE_BITRATE,
                    );

                const savedRoomName =
                    typeof userPreferences
                        .name ===
                        'string' &&
                    userPreferences
                        .name
                        .trim()
                        ? userPreferences
                            .name
                            .trim()
                        : null;

                const savedRegion =
                    typeof userPreferences
                        .rtcRegion ===
                        'string' &&
                    userPreferences
                        .rtcRegion
                        .trim()
                        ? userPreferences
                            .rtcRegion
                            .trim()
                        : null;

                const savedLocked =
                    userPreferences
                        .locked ===
                    true;

                const savedHidden =
                    userPreferences
                        .hidden ===
                    true;

                logger.info(
                    `Creating temporary channel for user ${member.id} with user limit: ${userLimit}`,
                );

                const existingChannels =
                    guild.channels.cache
                        .filter(
                            channel =>
                                channel.parentId ===
                                    triggerChannel.parentId &&
                                channel.name
                                    .startsWith(
                                        triggerChannel.name,
                                    ),
                        )
                        .size;

                let finalName;

                if (
                    savedRoomName
                ) {
                    finalName =
                        savedRoomName;
                } else if (
                    nameTemplate
                        .includes(
                            '{username}',
                        ) ||
                    nameTemplate
                        .includes(
                            '{displayName}',
                        )
                ) {
                    finalName =
                        formatChannelName(
                            nameTemplate,
                            {
                                username:
                                    member
                                        .user
                                        .username,

                                userTag:
                                    member
                                        .user
                                        .tag,

                                displayName:
                                    member
                                        .displayName,

                                guildName:
                                    guild
                                        .name,

                                channelName:
                                    triggerChannel
                                        .name,
                            },
                        );
                } else {
                    finalName =
                        `${triggerChannel.name} ${existingChannels + 1}`;
                }

                const channelName =
                    sanitizeVoiceChannelName(
                        finalName,
                    );

                if (
                    !member.voice
                        ?.channel ||
                    member.voice
                        .channel
                        .id !==
                        triggerChannel.id
                ) {
                    logger.debug(
                        `Member ${member.id} no longer in trigger channel ${triggerChannel.id}, aborting temporary channel creation`,
                    );

                    channelCreationCooldown
                        .delete(
                            cooldownKey,
                        );

                    return;
                }

                /**
                 * =================================================
                 * PERMISSION OVERWRITE
                 * =================================================
                 */

                const everyoneOverwrite = {
                    id:
                        guild.id,

                    allow: [
                        PermissionFlagsBits.Speak,
                    ],

                    deny:
                        [],
                };

                if (
                    savedLocked
                ) {
                    everyoneOverwrite
                        .deny
                        .push(
                            PermissionFlagsBits.Connect,
                        );
                } else {
                    everyoneOverwrite
                        .allow
                        .push(
                            PermissionFlagsBits.Connect,
                        );
                }

                if (
                    savedHidden
                ) {
                    everyoneOverwrite
                        .deny
                        .push(
                            PermissionFlagsBits.ViewChannel,
                        );
                } else {
                    everyoneOverwrite
                        .allow
                        .push(
                            PermissionFlagsBits.ViewChannel,
                        );
                }

                /**
                 * =================================================
                 * CREATE
                 * =================================================
                 */

                const tempChannel =
                    await guild.channels
                        .create({
                            name:
                                channelName,

                            type:
                                ChannelType.GuildVoice,

                            parent:
                                triggerChannel.parentId,

                            userLimit:
                                userLimit ===
                                0
                                    ? undefined
                                    : userLimit,

                            bitrate,

                            rtcRegion:
                                savedRegion,

                            permissionOverwrites: [
                                {
                                    id:
                                        member.id,

                                    allow: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.Connect,
                                        PermissionFlagsBits.Speak,
                                        PermissionFlagsBits.PrioritySpeaker,
                                        PermissionFlagsBits.MoveMembers,
                                    ],
                                },

                                everyoneOverwrite,
                            ],
                        });

                /**
                 * =================================================
                 * REGISTER TEMP ROOM
                 * =================================================
                 */

                await registerTemporaryChannel(
                    client,
                    guild.id,
                    tempChannel.id,
                    member.id,
                    triggerChannel.id,
                );

                /**
                 * =================================================
                 * MOVE USER
                 * =================================================
                 */

                if (
                    member.voice
                        ?.channel
                        ?.id ===
                    triggerChannel.id
                ) {
                    await member.voice
                        .setChannel(
                            tempChannel,
                        );
                } else {
                    logger.debug(
                        `Skipped moving ${member.id} to temporary channel ${tempChannel.id} because voice state changed`,
                    );
                }

                logger.info(
                    `Created temporary voice channel ${tempChannel.name} (${tempChannel.id}) for user ${member.user.tag} in guild ${guild.name} with user limit ${userLimit}`,
                );
            } catch (
                error
            ) {
                logger.error(
                    `Failed to create temporary channel for user ${member.user.tag} in guild ${guild.name}:`,
                    error,
                );

                channelCreationCooldown
                    .delete(
                        cooldownKey,
                    );

                try {
                    await member.send({
                        content:
                            '❌ Failed to create your temporary voice channel. Please contact a server administrator.',
                    });
                } catch (
                    dmError
                ) {
                    logger.debug(
                        `Unable to send temporary channel failure DM to user ${member.id}:`,
                        dmError,
                    );
                }
            }
        }

        /**
         * =====================================================
         * DELETE TEMPORARY CHANNEL
         * =====================================================
         */

        async function deleteTemporaryChannel(
            client,
            channel,
            guildId,
        ) {
            try {
                await unregisterTemporaryChannel(
                    client,
                    guildId,
                    channel.id,
                );

                await channel.delete(
                    'Temporary voice channel - empty',
                );

                logger.info(
                    `Deleted temporary voice channel ${channel.name} (${channel.id}) in guild ${channel.guild.name}`,
                );
            } catch (
                error
            ) {
                logger.error(
                    `Failed to delete temporary channel ${channel.id}:`,
                    error,
                );
            }
        }

        /**
         * =====================================================
         * TRANSFER OWNERSHIP
         * =====================================================
         */

        async function transferChannelOwnership(
            client,
            channel,
            guildId,
            newOwnerId,
        ) {
            try {
                const config =
                    await getJoinToCreateConfig(
                        client,
                        guildId,
                    );

                const tempChannelInfo =
                    config
                        .temporaryChannels[
                        channel.id
                    ];

                if (
                    !tempChannelInfo
                ) {
                    return;
                }

                tempChannelInfo.ownerId =
                    newOwnerId;

                await client.db.set(
                    `guild:${guildId}:jointocreate`,
                    config,
                );

                const newOwner =
                    await channel.guild
                        .members
                        .fetch(
                            newOwnerId,
                        );

                if (
                    newOwner
                ) {
                    const channelOptions =
                        config
                            .channelOptions?.[
                            tempChannelInfo
                                .triggerChannelId
                        ] ||
                        {};

                    const nameTemplate =
                        channelOptions
                            .nameTemplate ||
                        config
                            .channelNameTemplate ||
                        "{username}'s Room";

                    const newChannelName =
                        sanitizeVoiceChannelName(
                            formatChannelName(
                                nameTemplate,
                                {
                                    username:
                                        newOwner
                                            .user
                                            .username,

                                    userTag:
                                        newOwner
                                            .user
                                            .tag,

                                    displayName:
                                        newOwner
                                            .displayName,

                                    guildName:
                                        channel.guild
                                            .name,

                                    channelName:
                                        channel.guild
                                            .channels
                                            .cache
                                            .get(
                                                tempChannelInfo
                                                    .triggerChannelId,
                                            )
                                            ?.name ||
                                        'Voice Channel',
                                },
                            ),
                        );

                    await channel.setName(
                        newChannelName,
                    );
                }

                logger.info(
                    `Transferred ownership of temporary channel ${channel.id} to user ${newOwnerId}`,
                );
            } catch (
                error
            ) {
                logger.error(
                    `Failed to transfer ownership of channel ${channel.id}:`,
                    error,
                );
            }
        }

        /**
         * =====================================================
         * MUSIC VOICE STATE
         * =====================================================
         */

        if (
            client.config
                ?.features
                ?.music
        ) {
            handleMusicVoiceState(
                client,
                oldState,
                newState,
            ).catch(
                error => {
                    logger.error(
                        'Music voice state handler error:',
                        error,
                    );
                },
            );
        }
    },
};

/**
 * =========================================================
 * SANITIZE VOICE CHANNEL NAME
 * =========================================================
 */

function sanitizeVoiceChannelName(
    inputName,
) {
    const safeName =
        sanitizeInput(
            String(
                inputName ||
                '',
            ),
            MAX_CHANNEL_NAME_LENGTH,
        )
            .replace(
                /[\r\n\t]/g,
                ' ',
            )
            .replace(
                /\s+/g,
                ' ',
            )
            .trim();

    return (
        safeName ||
        FALLBACK_CHANNEL_NAME
    );
}

/**
 * =========================================================
 * CLAMP BITRATE
 * =========================================================
 */

function clampVoiceBitrate(
    value,
) {
    const parsed =
        Number(
            value,
        );

    if (
        !Number.isFinite(
            parsed,
        )
    ) {
        return DEFAULT_VOICE_BITRATE;
    }

    return Math.max(
        MIN_VOICE_BITRATE,
        Math.min(
            MAX_VOICE_BITRATE,
            Math.floor(
                parsed,
            ),
        ),
    );
}

/**
 * =========================================================
 * CLEANUP COOLDOWN
 * =========================================================
 */

function cleanupCooldownEntries() {
    const now =
        Date.now();

    for (
        const [
            key,
            timestamp,
        ] of channelCreationCooldown
            .entries()
    ) {
        if (
            now -
            timestamp >=
            VOICE_CREATE_COOLDOWN_MS
        ) {
            channelCreationCooldown
                .delete(
                    key,
                );
        }
    }
}

/**
 * =========================================================
 * TRIM COOLDOWN MAP
 * =========================================================
 */

function trimCooldownMapIfNeeded() {
    if (
        channelCreationCooldown
            .size <=
        MAX_TRACKED_COOLDOWNS
    ) {
        return;
    }

    const entries =
        [
            ...channelCreationCooldown
                .entries(),
        ].sort(
            (
                a,
                b,
            ) =>
                a[1] -
                b[1],
        );

    const removeCount =
        channelCreationCooldown
            .size -
        MAX_TRACKED_COOLDOWNS;

    for (
        let index = 0;
        index <
        removeCount;
        index +=
        1
    ) {
        channelCreationCooldown
            .delete(
                entries[
                    index
                ][0],
            );
    }
}
