import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(
    path.dirname(
        fileURLToPath(import.meta.url),
    ),
    '../../..',
);

function parseBoolean(
    value,
    defaultValue = false,
) {
    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        return defaultValue;
    }

    return [
        'true',
        '1',
        'yes',
    ].includes(
        String(value).toLowerCase(),
    );
}

function parseNodesPayload(
    parsed,
) {
    if (
        Array.isArray(parsed)
    ) {
        return parsed;
    }

    if (
        Array.isArray(
            parsed?.nodes,
        )
    ) {
        return parsed.nodes;
    }

    return null;
}


/*
 * =====================================================
 * LOAD NODES FROM FILE FIRST
 * =====================================================
 *
 * Đây là thay đổi quan trọng.
 *
 * lavalink/nodes.json được ưu tiên trước
 * LAVALINK_NODES.
 *
 * Như vậy nếu Railway/hosting còn giữ
 * LAVALINK_NODES cũ thì nó không thể
 * tiếp tục ép bot dùng node YouTube lỗi.
 */
function loadNodesFromFile() {
    const nodesFile =
        process.env.LAVALINK_NODES_FILE?.trim() ||
        path.join(
            projectRoot,
            'lavalink',
            'nodes.json',
        );

    if (
        !existsSync(nodesFile)
    ) {
        return null;
    }

    try {
        const parsed =
            JSON.parse(
                readFileSync(
                    nodesFile,
                    'utf8',
                ),
            );

        return parseNodesPayload(
            parsed,
        );
    } catch {
        return null;
    }
}


/*
 * =====================================================
 * LOAD NODES FROM ENV
 * =====================================================
 */
function loadNodesFromEnv() {
    const raw =
        process.env.LAVALINK_NODES?.trim();

    if (!raw) {
        return null;
    }

    try {
        const parsed =
            JSON.parse(raw);

        return Array.isArray(
            parsed,
        )
            ? parsed
            : null;
    } catch {
        return null;
    }
}


/*
 * =====================================================
 * FINAL NODE CONFIG
 * =====================================================
 */
export function getLavalinkNodes() {

    /*
     * 1. Repo nodes.json
     */
    const fromFile =
        loadNodesFromFile();

    if (
        fromFile?.length
    ) {
        return fromFile;
    }


    /*
     * 2. Environment variable
     */
    const fromEnv =
        loadNodesFromEnv();

    if (
        fromEnv?.length
    ) {
        return fromEnv;
    }


    /*
     * 3. Single fallback node
     */
    const host =
        process.env.LAVALINK_HOST ||
        'localhost';

    const port =
        Number(
            process.env.LAVALINK_PORT ||
            2333,
        );

    const password =
        process.env.LAVALINK_PASSWORD ||
        'youshallnotpass';

    const secure =
        parseBoolean(
            process.env.LAVALINK_SECURE,
            false,
        );

    return [
        {
            host,
            port,
            password,
            secure,
            name:
                process.env.LAVALINK_NAME ||
                'Main',
        },
    ];
}


export const lavalinkConfig = {
    nodes:
        getLavalinkNodes(),

    /*
     * Giữ nguyên Music hiện tại.
     * Audio dùng ytsearch: riêng nên không
     * bị ảnh hưởng.
     */
    defaultSearchPlatform:
        process.env.LAVALINK_SEARCH_PLATFORM ||
        'ytmsearch',

    restVersion:
        process.env.LAVALINK_REST_VERSION ||
        'v4',
};


export default lavalinkConfig;
