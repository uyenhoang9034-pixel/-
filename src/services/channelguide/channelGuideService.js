const STORAGE_KEY = guildId =>
    `guild:${guildId}:channelguide`;

export const GUIDE_ITEMS = [
    {
        id: 'information',
        label: 'Serendipity Information',
        emoji: '🌸',
        title: '🌸 Serendipity Information',
        description:
            'Khu vực giới thiệu chung về server, cách sử dụng các kênh và những thông tin cần biết khi tham gia Serendipity.',
    },
    {
        id: 'news',
        label: 'Serendipity-news',
        emoji: '🌿',
        title: '🌿 Serendipity-news',
        description:
            'Kênh cập nhật thông báo, tin tức và những thay đổi quan trọng của server. Hãy kiểm tra thường xuyên để không bỏ lỡ thông tin mới.',
    },
    {
        id: 'chat',
        label: 'Chat and Beyond',
        emoji: '🐰',
        title: '🐰 Chat and Beyond',
        description:
            'Không gian trò chuyện và giao lưu hằng ngày. Bạn có thể trò chuyện, chia sẻ những điều thú vị và làm quen với mọi người.',
    },
    {
        id: 'games',
        label: 'Game On!',
        emoji: '🎮',
        title: '🎮 Game On!',
        description:
            'Khu vực dành cho game: rủ người chơi cùng, chia sẻ khoảnh khắc trong game và bàn luận về những trò chơi bạn yêu thích.',
    },
    {
        id: 'sidequests',
        label: 'Side-quests',
        emoji: '🐾',
        title: '🐾 Side-quests',
        description:
            'Nơi dành cho những câu chuyện, hoạt động và chủ đề bên lề ngoài nội dung trò chuyện chính của server.',
    },
    {
        id: 'stuffies',
        label: 'Extra Stuffies',
        emoji: '🌺',
        title: '🌺 Extra Stuffies',
        description:
            'Khu vực cho những nội dung dễ thương, hình ảnh, khoảnh khắc đời thường và các chủ đề phụ đáng yêu.',
    },
    {
        id: 'boutique',
        label: "Usagi's-boutique",
        emoji: '🛍️',
        title: "🛍️ Usagi's-boutique",
        description:
            'Góc cửa hàng Usagi với các sản phẩm và vật phẩm đáng yêu của Serendipity.',
    },
    {
        id: 'voice',
        label: 'Voice Lounge',
        emoji: '🎤',
        title: '🎤 Voice Lounge',
        description:
            'Khu vực voice để mọi người trò chuyện trực tiếp, chơi game hoặc cùng nhau thư giãn.',
    },
];

const DEFAULT_CONFIG = {
    panelChannelId: null,
    panelMessageId: null,
    panelImage: null,
    channels: {},
};

function normalizeConfig(data) {
    if (
        !data ||
        typeof data !== 'object'
    ) {
        return {
            ...DEFAULT_CONFIG,
            channels: {},
        };
    }

    return {
        panelChannelId:
            typeof data.panelChannelId === 'string'
                ? data.panelChannelId
                : null,

        panelMessageId:
            typeof data.panelMessageId === 'string'
                ? data.panelMessageId
                : null,

        panelImage:
            typeof data.panelImage === 'string'
                ? data.panelImage
                : null,

        channels:
            data.channels &&
            typeof data.channels === 'object'
                ? {
                    ...data.channels,
                }
                : {},
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

    return normalizeConfig(data);
}

export async function saveChannelGuideConfig(
    client,
    guildId,
    config,
) {
    const normalized =
        normalizeConfig(config);

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
            channels: {
                ...current.channels,
                ...(patch.channels || {}),
            },
        },
    );
}

export function getGuideItem(id) {
    return GUIDE_ITEMS.find(
        item => item.id === id,
    ) || null;
}
