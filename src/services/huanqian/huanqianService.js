import {
    logger,
} from '../../utils/logger.js';


const DEFAULT_BUTTONS = [
    {
        id: 'info',
        label: 'Info',
        emoji: '🖼️',
        style: 'success',
        title: '🌸 Huan Qian — Info',
        description:
            'Thông tin chi tiết về dịch vụ Huan Qian.',
    },

    {
        id: 'source',
        label: 'Nguồn',
        emoji: '🖼️',
        style: 'primary',
        title: '🌸 Huan Qian — Nguồn',
        description:
            'Thông tin về nguồn, rate và các website được sử dụng.',
    },

    {
        id: 'note',
        label: 'Note',
        emoji: '📝',
        style: 'danger',
        title: '🌸 Huan Qian — Note',
        description:
            'Một số lưu ý quan trọng trước khi sử dụng dịch vụ.',
    },
];


const DEFAULT_CONFIG = {
    panelChannelId: null,

    panelMessageId: null,

    panelTitle:
        'Huan Qian — ⋆˚࿔⋆ — 换錢',

    panelDescription:
        [
            '↳ Dịch vụ miễn phí siêu cấp mới toanh và chỉ dành người thực sự cần thiết - đổi tiền tệ, cụ thể là tệ Trung aka RMB.',

            '↳ Ngoài ra có thể nạp game Trung Quốc (phải có web, không log game).',

            '↳ Ấn vào nút "Info" và "Nguồn" bên dưới để xem kĩ trước khi mở ticket giao dịch.',

            '↳ Chỉ mở ticket khi bạn đã chắc chắn hiểu rõ 100% cách hoạt động của dịch vụ.',

            '↳ Sau khi mở ticket và giao dịch thành công, vui lòng gửi hình ảnh feedback / gdtc vào kênh feedback.',
        ].join('\n'),

    panelColor:
        '#6F5846',

    /*
     * Chỉ có MỘT ảnh chính.
     *
     * Có thể thay đổi URL bằng nút Image
     * trong Dashboard.
     */
    panelImage: null,

    buttons: DEFAULT_BUTTONS,
};


function getStorageKey(
    guildId,
) {
    return `guild:${guildId}:huanqian`;
}


function isObject(
    value,
) {
    return (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
    );
}


function normalizeButton(
    button,
    fallback,
) {
    const source =
        isObject(button)
            ? button
            : {};

    return {
        id:
            fallback.id,

        label:
            String(
                source.label ??
                fallback.label,
            )
                .trim()
                .slice(0, 80),

        emoji:
            String(
                source.emoji ??
                fallback.emoji,
            )
                .trim()
                .slice(0, 100),

        style:
            [
                'primary',
                'secondary',
                'success',
                'danger',
            ].includes(
                String(
                    source.style ??
                    fallback.style,
                ).toLowerCase(),
            )
                ? String(
                    source.style ??
                    fallback.style,
                ).toLowerCase()
                : fallback.style,

        title:
            String(
                source.title ??
                fallback.title,
            )
                .trim()
                .slice(0, 256),

        description:
            String(
                source.description ??
                fallback.description,
            )
                .slice(0, 4000),
    };
}


export function normalizeHuanqianConfig(
    data,
) {
    const source =
        isObject(data)
            ? data
            : {};

    const sourceButtons =
        Array.isArray(
            source.buttons,
        )
            ? source.buttons
            : [];

    return {
        panelChannelId:
            typeof source.panelChannelId === 'string'
                ? source.panelChannelId
                : null,

        panelMessageId:
            typeof source.panelMessageId === 'string'
                ? source.panelMessageId
                : null,

        panelTitle:
            typeof source.panelTitle === 'string'
                ? source.panelTitle
                    .trim()
                    .slice(0, 256)
                : DEFAULT_CONFIG.panelTitle,

        panelDescription:
            typeof source.panelDescription === 'string'
                ? source.panelDescription
                    .slice(0, 4000)
                : DEFAULT_CONFIG.panelDescription,

        panelColor:
            typeof source.panelColor === 'string'
                ? source.panelColor
                    .trim()
                    .slice(0, 20)
                : DEFAULT_CONFIG.panelColor,

        panelImage:
            typeof source.panelImage === 'string'
                ? source.panelImage
                    .trim()
                    .slice(0, 2048)
                : null,

        /*
         * Luôn giữ đúng 3 button.
         */
        buttons:
            DEFAULT_BUTTONS.map(
                (
                    fallback,
                    index,
                ) =>
                    normalizeButton(
                        sourceButtons[index],
                        fallback,
                    ),
            ),
    };
}


export async function getHuanqianConfig(
    client,
    guildId,
) {
    const key =
        getStorageKey(
            guildId,
        );

    try {
        if (
            !client?.db ||
            typeof client.db.get !== 'function'
        ) {
            logger.warn(
                `[Huanqian] Database unavailable for guild ${guildId}`,
            );

            return normalizeHuanqianConfig(
                {},
            );
        }

        const data =
            await client.db.get(
                key,
                null,
            );

        return normalizeHuanqianConfig(
            data,
        );
    } catch (error) {
        logger.error(
            `[Huanqian] Failed to load config for guild ${guildId}`,
            error,
        );

        throw error;
    }
}


export async function saveHuanqianConfig(
    client,
    guildId,
    config,
) {
    const key =
        getStorageKey(
            guildId,
        );

    const normalized =
        normalizeHuanqianConfig(
            config,
        );

    if (
        !client?.db ||
        typeof client.db.set !== 'function'
    ) {
        throw new Error(
            'Database client is unavailable.',
        );
    }

    await client.db.set(
        key,
        normalized,
    );

    return normalized;
}


export function getHuanqianButton(
    config,
    buttonId,
) {
    const normalized =
        normalizeHuanqianConfig(
            config,
        );

    return normalized.buttons.find(
        button =>
            button.id === buttonId,
    ) || null;
}


export async function updateHuanqianButton(
    client,
    guildId,
    buttonId,
    updates = {},
) {
    const config =
        await getHuanqianConfig(
            client,
            guildId,
        );

    const index =
        config.buttons.findIndex(
            button =>
                button.id === buttonId,
        );

    if (
        index === -1
    ) {
        return null;
    }

    config.buttons[index] =
        normalizeButton(
            {
                ...config.buttons[index],
                ...updates,
            },
            DEFAULT_BUTTONS[index],
        );

    await saveHuanqianConfig(
        client,
        guildId,
        config,
    );

    return config.buttons[index];
}


export async function updateHuanqianPanel(
    client,
    guildId,
    updates = {},
) {
    const config =
        await getHuanqianConfig(
            client,
            guildId,
        );

    const next =
        normalizeHuanqianConfig(
            {
                ...config,
                ...updates,
            },
        );

    await saveHuanqianConfig(
        client,
        guildId,
        next,
    );

    return next;
}


export async function resetHuanqianConfig(
    client,
    guildId,
) {
    return saveHuanqianConfig(
        client,
        guildId,
        DEFAULT_CONFIG,
    );
}


export {
    DEFAULT_CONFIG as HUANQIAN_DEFAULT_CONFIG,
};
