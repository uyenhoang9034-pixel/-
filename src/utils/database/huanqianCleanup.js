import { pgConfig } from '../../config/database/postgres.js';

const CLEANUP_MARKER = '__meta:cleanup:huanqian:v1';
const HUANQIAN_KEY_PATTERN = '^guild:[0-9]+:huanqian$';

async function hasCompletedMarker(client) {
    const result = await client.query(
        `SELECT 1 FROM ${pgConfig.tables.temp_data} WHERE key = $1 LIMIT 1`,
        [CLEANUP_MARKER],
    );
    return result.rows.length > 0;
}

async function writeCompletedMarker(client, deleted) {
    await client.query(
        `INSERT INTO ${pgConfig.tables.temp_data} (key, value, expires_at, created_at)
         VALUES ($1, $2::jsonb, NULL, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [
            CLEANUP_MARKER,
            JSON.stringify({
                completedAt: new Date().toISOString(),
                deleted,
            }),
        ],
    );
}

/**
 * Remove obsolete Huan Qian records only.
 *
 * Historical Huan Qian storage used exactly:
 *   guild:<numeric guild id>:huanqian
 *
 * The anchored PostgreSQL regex intentionally excludes every other guild key
 * and every other table.
 */
export async function runHuanqianCleanup({ pool, logger = console } = {}) {
    if (!pool) {
        throw new Error('runHuanqianCleanup requires a connected pg pool');
    }

    const client = await pool.connect();

    try {
        if (await hasCompletedMarker(client)) {
            return { deleted: 0, alreadyDone: true };
        }

        await client.query('BEGIN');

        const result = await client.query(
            `DELETE FROM ${pgConfig.tables.temp_data}
             WHERE key ~ $1
             RETURNING key`,
            [HUANQIAN_KEY_PATTERN],
        );

        const deleted = result.rowCount ?? result.rows.length;
        await writeCompletedMarker(client, deleted);
        await client.query('COMMIT');

        logger.info(`Huan Qian cleanup complete: deleted ${deleted} obsolete record(s).`);
        return { deleted, alreadyDone: false };
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // Preserve the original cleanup error.
        }
        throw error;
    } finally {
        client.release();
    }
}
