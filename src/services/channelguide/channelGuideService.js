const STORAGE_KEY = guildId =>
    `guild:${guildId}:channelguide`;

const DEFAULT_GUIDES = [
    {
        id: 'information',
        label: 'Serendipity Information',
        emoji: '🌸',
        title: '🌸 Serendipity Information',
        description:
            'Khu vực giới thiệu chung về server, cách sử dụng các kênh và những thông tin cần biết khi tham gia Serendipity.',
        enabled: true,
        channels: [],
    },

    {
        id: 'news',
        label: 'Serendipity-news',
        emoji: '🌿',
        title: '🌿 Serendipity-news',
        description:
            'Kênh cập nhật thông báo, tin tức và những thay đổi quan trọng của server. Hãy kiểm tra thường xuyên để không bỏ lỡ thông tin mới.',
        enabled: true,
        channels: [],
    },

    {
        id: 'chat',
        label: 'Chat and Beyond',
        emoji: '🐰',
        title: '🐰 Chat and Beyond',
        description:
            'Không gian trò chuyện và giao lưu hằng ngày. Bạn có thể trò chuyện, chia sẻ những điều thú vị và làm quen với mọi người.',
        enabled: true,
        channels: [],
    },

    {
        id: 'games',
        label: 'Game On!',
        emoji: '🎮',
        title: '🎮 Game On!',
        description:
            'Khu vực dành cho game: rủ người chơi cùng, chia sẻ khoảnh khắc trong game và bàn luận về những trò chơi bạn yêu thích.',
        enabled: true,
        channels: [],
    },

    {
        id: 'sidequests',
        label: 'Side-quests',
        emoji: '🐾',
        title: '🐾 Side-quests',
        description:
            'Nơi dành cho những câu chuyện, hoạt động và chủ đề bên lề ngoài nội dung trò chuyện chính của server.',
        enabled: true,
        channels: [],
    },

    {
        id: 'stuffies',
        label: 'Extra Stuffies',
        emoji: '🌺',
        title: '🌺 Extra Stuffies',
        description:
            'Khu vực cho những nội dung dễ thương, hình ảnh, khoảnh khắc đời thường và các chủ đề phụ đáng yêu.',
        enabled: true,
        channels: [],
    },

    {
        id: 'boutique',
        label: "Usagi's-boutique",
        emoji: '🛍️',
        title: "🛍️ Usagi's-boutique",
        description:
            'Góc cửa hàng Usagi với các sản phẩm và vật phẩm đáng yêu của Serendipity.',
        enabled: true,
        channels: [],
    },

    {
        id: 'voice',
        label: 'Voice Lounge',
        emoji: '🎤',
        title: '🎤 Voice Lounge',
        description:
            'Khu vực voice để mọi người trò chuyện trực tiếp, chơi game hoặc cùng nhau thư giãn.',
        enabled: true,
        channels: [],
    },
];

const DEFAULT_CONFIG = {
    panelChannelId: null,
    panelMessageId: null,

    panelTitle:
        '𝓢𝓮𝓻𝓮𝓷𝓭𝓲𝓹𝓲𝓽𝔂 🖤🤍',

    panelDescription:
        'Hướng dẫn sử dụng các kênh discord server Serendipity 🖤🤍',

    panelImage: null,

    guides: [],
};

function cloneDefaultGuides() {
    return DEFAULT_GUIDES.map(
        guide => ({
            ...guide,
            channels: [],
        }),
    );
}

function normalizeChannel(channel) {
    if (
        typeof channel === 'string'
    ) {
        return {
            channelId: channel,
            description: '',
        };
    }

    if (
        !channel ||
        typeof channel !== 'object'
    ) {
        return null;
    }

    if (
        typeof channel.channelId !==
        'string'
    ) {
        return null;
    }

    return {
        channelId:
            channel.channelId,

        description:
            typeof channel.description ===
            'string'
                ? channel.description
                : '',
    };
}

function normalizeGuide(
    guide,
    fallback = null,
) {
    if (
        !guide ||
        typeof guide !== 'object'
    ) {
        return fallback;
    }

    if (
        typeof guide.id !== 'string' ||
        !guide.id.trim()
    ) {
        return fallback;
    }

    const base =
        fallback || {
            id: guide.id,
            label: guide.id,
            emoji: '📖',
            title: guide.id,
            description: '',
            enabled: true,
            channels: [],
        };

    const channels =
        Array.isArray(
            guide.channels,
        )
            ? guide.channels
                .map(normalizeChannel)
                .filter(Boolean)
            : [];

    return {
        ...base,

        ...guide,

        id:
            guide.id.trim(),

        label:
            typeof guide.label ===
            'string'
                ? guide.label.trim()
                : base.label,

        emoji:
            typeof guide.emoji ===
            'string'
                ? guide.emoji.trim()
                : base.emoji,

        title:
            typeof guide.title ===
            'string'
                ? guide.title.trim()
                : base.title,

        description:
            typeof guide.description ===
            'string'
                ? guide.description
                : base.description,

        enabled:
            guide.enabled !== false,

        channels,
    };
}

function migrateLegacyGuides(
    data,
) {
    const legacyChannels =
        data?.channels &&
        typeof data.channels ===
            'object'
            ? data.channels
            : {};

    return DEFAULT_GUIDES.map(
        defaultGuide => {
            const legacyChannelId =
                legacyChannels[
                    defaultGuide.id
                ];

            return {
                ...defaultGuide,

                channels:
                    typeof legacyChannelId ===
                    'string'
                        ? [
                            {
                                channelId:
                                    legacyChannelId,

                                description:
                                    '',
                            },
                        ]
                        : [],
            };
        },
    );
}

function normalizeConfig(data) {
    if (
        !data ||
        typeof data !== 'object'
    ) {
        return {
            ...DEFAULT_CONFIG,
            guides:
                cloneDefaultGuides(),
        };
    }

    let guides;

    if (
        Array.isArray(data.guides)
    ) {
        guides =
            data.guides
                .map(guide =>
                    normalizeGuide(
                        guide,
                    ),
                )
                .filter(Boolean);
    } else {
        guides =
            migrateLegacyGuides(
                data,
            );
    }

    if (
        guides.length === 0
    ) {
        guides =
            cloneDefaultGuides();
    }

    return {
        panelChannelId:
            typeof data.panelChannelId ===
            'string'
                ? data.panelChannelId
                : null,

        panelMessageId:
            typeof data.panelMessageId ===
            'string'
                ? data.panelMessageId
                : null,

        panelTitle:
            typeof data.panelTitle ===
            'string'
                ? data.panelTitle
                : DEFAULT_CONFIG.panelTitle,

        panelDescription:
            typeof data.panelDescription ===
            'string'
                ? data.panelDescription
                : DEFAULT_CONFIG.panelDescription,

        panelImage:
            typeof data.panelImage ===
            'string'
                ? data.panelImage
                : null,

        guides,
    };
}

export async function getChannelGuideConfig(
    client,
    guildId,
) {
    const data =
        await client.db.get(
            STORAGE_KEY(guildId),
            null,
        );

    return normalizeConfig(
        data,
    );
}

export async function saveChannelGuideConfig(
    client,
    guildId,
    config,
) {
    const normalized =
        normalizeConfig(
            config,
        );

    await client.db.set(
        STORAGE_KEY(guildId),
        normalized,
    );

    return normalized;
}

export async function setChannelGuideConfig(
    client,
    guildId,
    patch,
) {
    const current =
        await getChannelGuideConfig(
            client,
            guildId,
        );

    return saveChannelGuideConfig(
        client,
        guildId,
        {
            ...current,
            ...patch,

            guides:
                Array.isArray(
                    patch.guides,
                )
                    ? patch.guides
                    : current.guides,
        },
    );
}

export function getGuideItem(
    config,
    guideId,
) {
    return (
        config.guides.find(
            guide =>
                guide.id === guideId,
        ) || null
    );
}

export async function createGuide(
    client,
    guildId,
    guide,
) {
    const config =
        await getChannelGuideConfig(
            client,
            guildId,
        );

    const newGuide =
        normalizeGuide(
            {
                ...guide,
                id:
                    guide.id ||
                    `guide_${Date.now()}_${Math.random()
                        .toString(36)
                        .slice(2, 8)}`,
            },
        );

    config.guides.push(
        newGuide,
    );

    return saveChannelGuideConfig(
        client,
        guildId,
        config,
    );
}

export async function updateGuide(
    client,
    guildId,
    guideId,
    patch,
) {
    const config =
        await getChannelGuideConfig(
            client,
            guildId,
        );

    const index =
        config.guides.findIndex(
            guide =>
                guide.id === guideId,
        );

    if (index === -1) {
        return null;
    }

    config.guides[index] =
        normalizeGuide({
            ...config.guides[index],
            ...patch,
            id: guideId,
        });

    await saveChannelGuideConfig(
        client,
        guildId,
        config,
    );

    return config.guides[index];
}

export async function deleteGuide(
    client,
    guildId,
    guideId,
) {
    const config =
        await getChannelGuideConfig(
            client,
            guildId,
        );

    config.guides =
        config.guides.filter(
            guide =>
                guide.id !== guideId,
        );

    return saveChannelGuideConfig(
        client,
        guildId,
        config,
    );
}

export async function toggleGuide(
    client,
    guildId,
    guideId,
) {
    const config =
        await getChannelGuideConfig(
            client,
            guildId,
        );

    const guide =
        config.guides.find(
            item =>
                item.id === guideId,
        );

    if (!guide) {
        return null;
    }

    guide.enabled =
        guide.enabled === false;

    await saveChannelGuideConfig(
        client,
        guildId,
        config,
    );

    return guide;
}

export async function moveGuide(
    client,
    guildId,
    guideId,
    direction,
) {
    const config =
        await getChannelGuideConfig(
            client,
            guildId,
        );

    const index =
        config.guides.findIndex(
            guide =>
                guide.id === guideId,
        );

    if (index === -1) {
        return null;
    }

    const target =
        direction === 'up'
            ? index - 1
            : index + 1;

    if (
        target < 0 ||
        target >=
            config.guides.length
    ) {
        return config.guides[index];
    }

    [
        config.guides[index],
        config.guides[target],
    ] = [
        config.guides[target],
        config.guides[index],
    ];

    await saveChannelGuideConfig(
        client,
        guildId,
        config,
    );

    return config.guides[target];
}
