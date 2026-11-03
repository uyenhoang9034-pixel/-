import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  PermissionFlagsBits,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { deflateRawSync } from 'node:zlib';
import { pgConfig } from '../../config/database/postgres.js';
import { logger } from '../../utils/logger.js';

const TABLE = pgConfig.tables.financial_transactions;
const ADMIN_ROLE_IDS = new Set([
  '1541303749916754001',
  '1545305594712432640',
]);
const PAGE_SIZE = 6;
const TZ = 'Asia/Ho_Chi_Minh';

export const LEDGER_EMOJIS = {
  titleLeft: '<a:trangtrig2:1546040703375904801>',
  titleRight: '<a:trangtrig3:1546040818261954610>',
  heart: '<a:heartg1:1545307544808071258>',
  notice: '<a:bang2:1546891483250954290>',
  detail: '<a:bang4:1546905765439217666>',
  expense: '<a:bang3:1546891744237461635>',
  usagi: '<:usagi9:1541422359960092813>',
  decoration: '<a:trangtrig29:1546385117478527016>',
};

function getPool(client) {
  const database = client?.db?.db;
  if (!database || typeof database.isAvailable !== 'function' || !database.isAvailable()) return null;
  return database.pool || null;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN') + 'đ';
}

function formatDate(value) {
  return new Date(value).toLocaleString('vi-VN', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function titleLine(title) {
  return '# ' + LEDGER_EMOJIS.titleLeft + ' **' + title + '** ' + LEDGER_EMOJIS.titleRight;
}

function separator() {
  return new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
}

function createContainer(title, lines = []) {
  const container = new ContainerBuilder();
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(titleLine(title)));
  container.addSeparatorComponents(separator());
  if (lines.length) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  }
  return container;
}

function v2Payload(container, extra = {}) {
  const { allowedMentions = {}, ...rest } = extra;
  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    ...rest,
    allowedMentions: { parse: [], ...allowedMentions },
  };
}

export function isFinancialAdmin(member) {
  if (!member) return false;
  if (member.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;
  const roleIds = member.roles?.cache
    ? [...member.roles.cache.keys()]
    : (Array.isArray(member.roles) ? member.roles : []);
  return roleIds.some(roleId => ADMIN_ROLE_IDS.has(String(roleId)));
}

function requirePool(client) {
  const pool = getPool(client);
  if (!pool) throw new Error('PostgreSQL đang không khả dụng. Sổ quỹ không ghi dữ liệu vào RAM để tránh mất lịch sử.');
  return pool;
}

async function insertTransaction(client, data) {
  const pool = requirePool(client);
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    await connection.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['usagi-financial:' + data.guildId]);

    if (data.scope === 'common' && data.amount < 0) {
      const balanceResult = await connection.query(
        'SELECT COALESCE(SUM(amount), 0)::bigint AS balance FROM ' + TABLE + ' WHERE guild_id = $1 AND scope = $2',
        [data.guildId, 'common'],
      );
      const balance = Number(balanceResult.rows[0]?.balance || 0);
      if (balance < Math.abs(data.amount)) {
        throw new Error('Quỹ chung hiện chỉ còn ' + formatMoney(balance) + ', không đủ để thực hiện khoản chi này.');
      }
    }

    const result = await connection.query(
      'INSERT INTO ' + TABLE + ' (guild_id, scope, donor_id, donor_label, amount, reason, actor_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at',
      [data.guildId, data.scope, data.donorId || null, data.donorLabel || null, data.amount, data.reason || null, data.actorId],
    );
    await connection.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await connection.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function getPersonalTotal(client, guildId, userId) {
  const pool = requirePool(client);
  const result = await pool.query(
    'SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM ' + TABLE + ' WHERE guild_id = $1 AND scope = $2 AND donor_id = $3',
    [guildId, 'personal', userId],
  );
  return Number(result.rows[0]?.total || 0);
}

async function getCommonSummary(client, guildId, range = null) {
  const pool = requirePool(client);
  const values = [guildId, 'common'];
  let where = 'guild_id = $1 AND scope = $2';
  if (range) {
    values.push(range.start, range.end);
    where += ' AND created_at >= $3 AND created_at < $4';
  }
  const result = await pool.query(
    'SELECT COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::bigint AS income, COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0), 0)::bigint AS expense, COALESCE(SUM(amount), 0)::bigint AS balance FROM ' + TABLE + ' WHERE ' + where,
    values,
  );
  const row = result.rows[0] || {};
  return {
    income: Number(row.income || 0),
    expense: Number(row.expense || 0),
    balance: Number(row.balance || 0),
  };
}

function createPaginationRow(scope, ownerId, page, totalPages) {
  const previous = new ButtonBuilder()
    .setCustomId('financial_page:' + scope + ':' + ownerId + ':' + Math.max(0, page - 1) + ':previous')
    .setLabel('◀')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0);
  const next = new ButtonBuilder()
    .setCustomId('financial_page:' + scope + ':' + ownerId + ':' + Math.min(totalPages - 1, page + 1) + ':next')
    .setLabel('▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1);
  return new ActionRowBuilder().addComponents(previous, next);
}

export async function buildHistoryMessage(client, guildId, scope, userId, page = 0, ownerId = userId) {
  const pool = requirePool(client);
  const safePage = Math.max(0, Number(page) || 0);
  let totalRows;
  let totalPages;
  let rows;
  let container;

  if (scope === 'personal') {
    const count = await pool.query(
      'SELECT COUNT(*)::int AS count FROM ' + TABLE + ' WHERE guild_id = $1 AND scope = $2 AND donor_id = $3',
      [guildId, 'personal', userId],
    );
    totalRows = Number(count.rows[0]?.count || 0);
    totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    const currentPage = Math.min(safePage, totalPages - 1);
    const [total, history] = await Promise.all([
      getPersonalTotal(client, guildId, userId),
      pool.query(
        'SELECT id, amount, created_at FROM ' + TABLE + ' WHERE guild_id = $1 AND scope = $2 AND donor_id = $3 ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $5',
        [guildId, 'personal', userId, PAGE_SIZE, currentPage * PAGE_SIZE],
      ),
    ]);
    rows = history.rows;
    container = createContainer('LỊCH SỬ DONATE');
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      '**<@' + userId + '> đã donate tổng ' + formatMoney(total) + ' tích lũy từ trước đến nay. Một tấm lòng bác ái!**',
    ));
    container.addSeparatorComponents(separator());
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(LEDGER_EMOJIS.usagi + ' **Lịch sử ghi nhận**'));
    const historyLines = rows.length
      ? rows.map((row, index) => LEDGER_EMOJIS.heart + ' **#' + row.id + ' · ' + formatDate(row.created_at) + '**\n' + LEDGER_EMOJIS.detail + ' **+' + formatMoney(row.amount) + '**').join('\n')
      : 'Chưa có lịch sử donate nào được ghi nhận.';
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(historyLines));
    container.addSeparatorComponents(separator());
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Trang **' + (currentPage + 1) + ' / ' + totalPages + '**'));
    container.addActionRowComponents(createPaginationRow(scope, ownerId, currentPage, totalPages));
    return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
  }

  const [summary, count] = await Promise.all([
    getCommonSummary(client, guildId),
    pool.query('SELECT COUNT(*)::int AS count FROM ' + TABLE + ' WHERE guild_id = $1 AND scope = $2', [guildId, 'common']),
  ]);
  totalRows = Number(count.rows[0]?.count || 0);
  totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const currentPage = Math.min(safePage, totalPages - 1);
  const history = await pool.query(
    'SELECT id, donor_id, donor_label, amount, reason, created_at FROM ' + TABLE + ' WHERE guild_id = $1 AND scope = $2 ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4',
    [guildId, 'common', PAGE_SIZE, currentPage * PAGE_SIZE],
  );
  rows = history.rows;

  container = createContainer('QUỸ CHUNG');
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
    '## ' + LEDGER_EMOJIS.heart + ' **TỔNG TIỀN DONATE**\n**' + formatMoney(summary.income) + '**',
    '## ' + LEDGER_EMOJIS.expense + ' **TỔNG TIỀN CHI**\n**' + formatMoney(summary.expense) + '**',
    '## ' + LEDGER_EMOJIS.notice + ' **SỐ DƯ QUỸ CHUNG HIỆN TẠI**\n**' + formatMoney(summary.balance) + '**',
  ].join('\n\n')));
  container.addSeparatorComponents(separator());
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('**Lịch sử thu chi**'));
  const historyLines = rows.length ? rows.map(row => {
    const date = formatDate(row.created_at);
    if (Number(row.amount) > 0) {
      const donor = row.donor_id ? '<@' + row.donor_id + '>' : (row.donor_label || 'Ẩn Danh');
      return LEDGER_EMOJIS.heart + ' **#' + row.id + ' · ' + date + '**\n' +
        LEDGER_EMOJIS.heart + ' **Người donate:** ' + donor + '\n' +
        LEDGER_EMOJIS.heart + ' **Khoản thu:** **+' + formatMoney(row.amount) + '**';
    }
    return LEDGER_EMOJIS.expense + ' **#' + row.id + ' · ' + date + '**\n' +
      LEDGER_EMOJIS.heart + ' **Khoản chi:** **' + formatMoney(Math.abs(Number(row.amount))) + '**\n' +
      LEDGER_EMOJIS.notice + ' **Lý do chi:** ' + (row.reason || 'Không có');
  }).join('\n\n') : 'Quỹ chung chưa có giao dịch nào.';
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(historyLines));
  container.addSeparatorComponents(separator());
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Trang **' + (currentPage + 1) + ' / ' + totalPages + '**'));
  container.addActionRowComponents(createPaginationRow(scope, ownerId, currentPage, totalPages));
  return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

export async function handleFinancialPage(interaction, client, args = []) {
  const [scope, ownerId, pageText] = args;
  if (!['personal', 'common'].includes(scope) || !ownerId) {
    await interaction.reply({ content: 'Trang tra cứu không hợp lệ.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (scope === 'personal' && interaction.user.id !== ownerId) {
    await interaction.reply({ content: 'Chỉ chủ tài khoản mới có thể chuyển trang lịch sử donate cá nhân.', flags: MessageFlags.Ephemeral });
    return;
  }
  const payload = await buildHistoryMessage(client, interaction.guildId, scope, ownerId, Number(pageText), ownerId);
  const { flags, ...updatePayload } = payload;
  await interaction.update(updatePayload);
}

export async function handleFinancialPrefix(message, client) {
  const content = String(message.content || '').trim();
  if (!/^&(?:add|addquychung|trutien)(?:\s|$)/i.test(content)) return false;

  if (!isFinancialAdmin(message.member)) {
    await message.reply('Bạn không có quyền sử dụng lệnh quản lý sổ quỹ.').catch(() => {});
    return true;
  }

  try {
    let result;
    if (/^&add\s/i.test(content)) {
      const match = content.match(/^&add\s+<@!?(\d{17,20})>\s+([\d.,]+)\s*$/i);
      if (!match) throw new Error('Cú pháp: `&add @User số_tiền`');
      const amount = parseAmount(match[2]);
      result = await insertTransaction(client, {
        guildId: message.guild.id,
        scope: 'personal',
        donorId: match[1],
        donorLabel: null,
        amount,
        actorId: message.author.id,
      });
      const total = await getPersonalTotal(client, message.guild.id, match[1]);
      const container = createContainer('Sổ ghi nhận ủng hộ');
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        LEDGER_EMOJIS.heart + ' **Người ủng hộ:** <@' + match[1] + '>',
        LEDGER_EMOJIS.heart + ' **Số tiền ghi nhận:** **+' + formatMoney(amount) + '**',
        LEDGER_EMOJIS.heart + ' **Thời gian ghi nhận:** ' + formatDate(result.created_at),
      ].join('\n')));
      container.addSeparatorComponents(separator());
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        '**TỔNG DONATE CÁ NHÂN**\n# ' + formatMoney(total) + '\nĐã bao gồm khoản ghi nhận mới nhất',
      ));
      await message.channel.send(v2Payload(container, { allowedMentions: { users: [match[1]] } }));
      return true;
    }

    if (/^&addquychung\s/i.test(content)) {
      const match = content.match(/^&addquychung\s+([\d.,]+)(?:\s+<@!?(\d{17,20})>)?\s*$/i);
      if (!match) throw new Error('Cú pháp: `&addquychung số_tiền [@User]`');
      const amount = parseAmount(match[1]);
      result = await insertTransaction(client, {
        guildId: message.guild.id,
        scope: 'common',
        donorId: match[2] || null,
        donorLabel: match[2] ? null : 'Ẩn Danh',
        amount,
        actorId: message.author.id,
      });
      const summary = await getCommonSummary(client, message.guild.id);
      const donor = match[2] ? '<@' + match[2] + '>' : 'Ẩn Danh';
      const container = createContainer('QUỸ CHUNG', [
        LEDGER_EMOJIS.heart + ' **Người donate:** ' + donor,
        LEDGER_EMOJIS.heart + ' **Khoản thu:** **+' + formatMoney(amount) + '**',
        LEDGER_EMOJIS.heart + ' **Thời gian:** ' + formatDate(result.created_at),
      ]);
      container.addSeparatorComponents(separator());
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        '**SỐ DƯ QUỸ CHUNG**\n# ' + formatMoney(summary.balance),
      ));
      await message.channel.send(v2Payload(container, { allowedMentions: match[2] ? { users: [match[2]] } : {} }));
      return true;
    }

    const match = content.match(/^&trutien\s+([\d.,]+)\s+["']?(.+?)["']?\s*$/i);
    if (!match) throw new Error('Cú pháp: `&trutien số_tiền "Lý do chi"`');
    const amount = parseAmount(match[1]);
    const reason = match[2].trim().replace(/^["']|["']$/g, '');
    if (!reason) throw new Error('Vui lòng nhập lý do chi.');
    if (reason.length > 300) throw new Error('Lý do chi không được dài quá 300 ký tự.');
    result = await insertTransaction(client, {
      guildId: message.guild.id,
      scope: 'common',
      amount: -amount,
      reason,
      actorId: message.author.id,
    });
    const summary = await getCommonSummary(client, message.guild.id);
    const container = createContainer('QUỸ CHUNG', [
      LEDGER_EMOJIS.heart + ' **Khoản chi:** **' + formatMoney(amount) + '**',
      LEDGER_EMOJIS.notice + ' **Lý do chi:** ' + reason,
      LEDGER_EMOJIS.heart + ' **Thời gian ghi nhận:** ' + formatDate(result.created_at),
    ]);
    container.addSeparatorComponents(separator());
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      '**SỐ DƯ SAU KHI CHI**\n# ' + formatMoney(summary.balance),
    ));
    await message.channel.send(v2Payload(container));
    return true;
  } catch (error) {
    await message.reply(LEDGER_EMOJIS.notice + ' ' + (error.message || 'Không thể ghi nhận giao dịch.')).catch(() => {});
    return true;
  }
}

function parseAmount(raw) {
  const normalized = String(raw).replace(/[.,\s]/g, '');
  if (!/^\d+$/.test(normalized)) throw new Error('Số tiền không hợp lệ.');
  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Số tiền phải là số nguyên dương hợp lệ.');
  return amount;
}

function getMonthRange(month, year) {
  const startLocal = new Date(Date.UTC(year, month - 1, 1));
  const endLocal = new Date(Date.UTC(year, month, 1));
  const offset = 7 * 60 * 60 * 1000;
  return {
    start: new Date(startLocal.getTime() - offset),
    end: new Date(endLocal.getTime() - offset),
  };
}

function getCurrentVietnamMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month) };
}

async function buildMonthlyReport(client, guildId, month, year) {
  const pool = requirePool(client);
  const range = getMonthRange(month, year);
  const [openingResult, summary, transactions, personal] = await Promise.all([
    pool.query(
      'SELECT COALESCE(SUM(amount), 0)::bigint AS balance FROM ' + TABLE + ' WHERE guild_id = $1 AND scope = $2 AND created_at < $3',
      [guildId, 'common', range.start],
    ),
    getCommonSummary(client, guildId, range),
    pool.query(
      'SELECT id, scope, donor_id, donor_label, amount, reason, actor_id, created_at FROM ' + TABLE + ' WHERE guild_id = $1 AND scope = $4 AND created_at >= $2 AND created_at < $3 ORDER BY created_at ASC, id ASC',
      [guildId, range.start, range.end, 'common'],
    ),
    pool.query(
      'SELECT donor_id, COALESCE(SUM(amount), 0)::bigint AS total, COUNT(*)::int AS transactions FROM ' + TABLE + ' WHERE guild_id = $1 AND scope = $2 AND created_at >= $3 AND created_at < $4 GROUP BY donor_id ORDER BY total DESC',
      [guildId, 'personal', range.start, range.end],
    ),
  ]);
  return {
    opening: Number(openingResult.rows[0]?.balance || 0),
    income: summary.income,
    expense: summary.expense,
    closing: Number(openingResult.rows[0]?.balance || 0) + summary.balance,
    transactions: transactions.rows,
    personal: personal.rows,
  };
}

function xmlEscape(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function columnName(number) {
  let name = '';
  let n = number;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function worksheetXml(rows) {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const ref = columnName(colIndex + 1) + (rowIndex + 1);
      if (typeof value === 'number' && Number.isFinite(value)) {
        return '<c r="' + ref + '"><v>' + value + '</v></c>';
      }
      return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEscape(value) + '</t></is></c>';
    }).join('');
    return '<row r="' + (rowIndex + 1) + '">' + cells + '</row>';
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + body + '</sheetData></worksheet>';
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function zipFiles(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const raw = Buffer.from(file.content, 'utf8');
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034B50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014B50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054B50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function createXlsx(sheets) {
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
    '</Types>';
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map((sheet, i) => '<sheet name="' + xmlEscape(sheet.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') +
    '</sheets></workbook>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
    '</Relationships>';
  const files = [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: rels },
  ];
  sheets.forEach((sheet, i) => files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', content: worksheetXml(sheet.rows) }));
  return zipFiles(files);
}

export async function exportMonthlyWorkbook(client, guildId, month, year, report = null) {
  const monthlyData = report || await buildMonthlyReport(client, guildId, month, year);
  const monthLabel = String(month).padStart(2, '0') + '/' + year;
  const summaryRows = [
    ['Bảng Tổng Kết Tháng', monthLabel],
    ['Số dư đầu tháng', monthlyData.opening],
    ['Tổng tiền donate', monthlyData.income],
    ['Tổng tiền chi', monthlyData.expense],
    ['Số dư cuối tháng', monthlyData.closing],
  ];
  const commonRows = [['Mã giao dịch', 'Thời gian', 'Loại', 'Người donate', 'Khoản tiền', 'Lý do chi', 'Người ghi nhận']];
  const personalRows = [['Discord User ID', 'Tổng donate trong tháng', 'Số giao dịch']];
  for (const row of monthlyData.transactions) {
    if (row.scope !== 'common') continue;
    commonRows.push([
      Number(row.id),
      formatDate(row.created_at),
      Number(row.amount) > 0 ? 'Donate' : 'Chi',
      Number(row.amount) > 0 ? (row.donor_id || row.donor_label || 'Ẩn Danh') : '',
      Number(row.amount),
      row.reason || '',
      row.actor_id || '',
    ]);
  }
  for (const row of monthlyData.personal) {
    personalRows.push([row.donor_id, Number(row.total), Number(row.transactions)]);
  }
  const buffer = createXlsx([
    { name: 'TongKetThang', rows: summaryRows },
    { name: 'QuyChung', rows: commonRows },
    { name: 'DonateCaNhan', rows: personalRows },
  ]);
  return new AttachmentBuilder(buffer, {
    name: 'Usagi_BaoCao_Thang_' + String(month).padStart(2, '0') + '_' + year + '.xlsx',
    description: 'Bảng Tổng Kết Tháng ' + monthLabel,
  });
}

export const financialLedgerCommand = new SlashCommandBuilder()
  .setName('tracuu')
  .setDescription('Tra cứu lịch sử donate cá nhân và Quỹ chung')
  .addSubcommand(subcommand => subcommand
    .setName('canhan')
    .setDescription('Xem lịch sử donate của bản thân'))
  .addSubcommand(subcommand => subcommand
    .setName('quychung')
    .setDescription('Xem sổ thu chi Quỹ chung'));

export const financialExportCommand = new SlashCommandBuilder()
  .setName('xuatbaocao')
  .setDescription('Xuất file Excel Bảng Tổng Kết Tháng')
  .addIntegerOption(option => option.setName('thang').setDescription('Tháng cần xuất (1-12)').setMinValue(1).setMaxValue(12))
  .addIntegerOption(option => option.setName('nam').setDescription('Năm cần xuất').setMinValue(2020).setMaxValue(2100));

export async function executeFinancialSlash(interaction, client) {
  const subcommand = interaction.options.getSubcommand();
  const scope = subcommand === 'canhan' ? 'personal' : 'common';
  const payload = await buildHistoryMessage(
    client,
    interaction.guildId,
    scope,
    interaction.user.id,
    0,
    interaction.user.id,
  );
  await interaction.reply({
    ...payload,
    flags: MessageFlags.IsComponentsV2 | (scope === 'personal' ? MessageFlags.Ephemeral : 0),
  });
}

async function buildMonthlySummaryContainer(report, month, year) {
  const monthLabel = String(month).padStart(2, '0') + '/' + year;
  const container = createContainer('Bảng Tổng Kết Tháng', [
    LEDGER_EMOJIS.decoration + ' **THÁNG ' + monthLabel + '**',
  ]);
  container.addSeparatorComponents(separator());
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
    '## ' + LEDGER_EMOJIS.heart + ' **TỔNG TIỀN DONATE**\n**' + formatMoney(report.income) + '**',
    '## ' + LEDGER_EMOJIS.expense + ' **TỔNG TIỀN CHI**\n**' + formatMoney(report.expense) + '**',
    '## ' + LEDGER_EMOJIS.notice + ' **SỐ DƯ CUỐI THÁNG**\n**' + formatMoney(report.closing) + '**',
  ].join('\n\n')));
  container.addSeparatorComponents(separator());
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
    LEDGER_EMOJIS.heart + ' **Số dư đầu tháng:** ' + formatMoney(report.opening),
    LEDGER_EMOJIS.heart + ' **Donate trong tháng:** +' + formatMoney(report.income),
    LEDGER_EMOJIS.expense + ' **Chi trong tháng:** -' + formatMoney(report.expense),
  ].join('\n')));
  const expenses = report.transactions.filter(row => row.scope === 'common' && Number(row.amount) < 0);
  if (expenses.length) {
    container.addSeparatorComponents(separator());
    const visibleExpenses = expenses.slice(0, 10);
    const expenseLines = visibleExpenses.map(row =>
      LEDGER_EMOJIS.expense + ' ' + formatDate(row.created_at) + ' · ' +
      (row.reason || 'Không có lý do') + ': **' + formatMoney(Math.abs(Number(row.amount))) + '**'
    );
    if (expenses.length > visibleExpenses.length) {
      expenseLines.push('*Còn ' + (expenses.length - visibleExpenses.length) + ' khoản chi khác trong file Excel.*');
    }
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      '**Các khoản chi trong tháng**\n' + expenseLines.join('\n')
    ));
  }
  return container;
}

export async function executeFinancialExport(interaction, client) {
  if (!isFinancialAdmin(interaction.member)) {
    await interaction.reply({ content: 'Bạn không có quyền xuất báo cáo Quỹ chung.', flags: MessageFlags.Ephemeral });
    return;
  }
  const current = getCurrentVietnamMonth();
  const month = interaction.options.getInteger('thang') || current.month;
  const year = interaction.options.getInteger('nam') || current.year;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  const report = await buildMonthlyReport(client, interaction.guildId, month, year);
  const attachment = await exportMonthlyWorkbook(client, interaction.guildId, month, year, report);
  const container = await buildMonthlySummaryContainer(report, month, year);
  await interaction.editReply({
    components: [container],
    files: [attachment],
    allowedMentions: { parse: [] },
  });
}

export async function initializeFinancialLedger(client) {
  const pool = getPool(client);
  if (!pool) {
    logger.warn('[FinancialLedger] PostgreSQL unavailable; ledger commands will remain disabled until persistent storage returns.');
    return false;
  }
  await pool.query(
    'CREATE TABLE IF NOT EXISTS ' + TABLE + ' (id BIGSERIAL PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, scope VARCHAR(16) NOT NULL CHECK (scope IN (\'personal\', \'common\')), donor_id VARCHAR(20), donor_label VARCHAR(100), amount BIGINT NOT NULL CHECK (amount <> 0), reason TEXT, actor_id VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  );
  await pool.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_guild_scope_created ON ' + TABLE + ' (guild_id, scope, created_at DESC, id DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_personal_user ON ' + TABLE + ' (guild_id, donor_id, created_at DESC) WHERE scope = \'personal\'');
  logger.info('[FinancialLedger] PostgreSQL ledger table is ready.');
  return true;
}
