import crypto from 'node:crypto';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { pgConfig } from '../../config/database/postgres.js';
import { logger } from '../../utils/logger.js';

export const DONATE_CONFIG = {
  bankName: process.env.DONATE_BANK_NAME || 'Vietinbank',
  bankCode: process.env.DONATE_BANK_CODE || 'ICB',
  accountNumber: process.env.DONATE_ACCOUNT_NUMBER || '109872322675',
  accountName: process.env.DONATE_ACCOUNT_NAME || 'Hoàng Uyên',
  channelId: process.env.DONATE_CHANNEL_ID || '1567185361900413089',
  sepayApiKey: process.env.SEPAY_API_KEY || 'serendipity_sepay_key_99',
  requestExpiryMinutes: Math.max(5, Number(process.env.DONATE_QR_EXPIRY_MINUTES || 30)),
};

export const DONATE_EMOJIS = {
  titleLeft: '<a:trangtrig2:1546040703375904801>',
  titleRight: '<a:trangtrig3:1546040818261954610>',
  heart: '<a:heartg1:1545307544808071258>',
  notice: '<a:bang2:1546891483250954290>',
};

function getDonatePool(client) {
  const database = client?.db?.db;
  if (!database || typeof database.isAvailable !== 'function' || !database.isAvailable()) {
    return null;
  }
  return database.pool || null;
}

function createQrUrl(paymentContent) {
  const url = new URL('https://vietqr.app/img');
  url.searchParams.set('acc', DONATE_CONFIG.accountNumber);
  url.searchParams.set('bank', DONATE_CONFIG.bankCode);
  url.searchParams.set('des', paymentContent);
  return url.toString();
}

async function createDonationRequest(client, author) {
  const pool = getDonatePool(client);
  if (!pool) {
    throw new Error('PostgreSQL is unavailable; cannot safely create a persistent donation request.');
  }

  // Dọn các QR đã hết hạn và bản ghi chống trùng đã quá thời gian lưu.
  await pool.query(
    `DELETE FROM ${pgConfig.tables.temp_data}
     WHERE (key LIKE 'donate:pending:%' OR key LIKE 'donate:sepay:transaction:%')
       AND expires_at IS NOT NULL AND expires_at <= NOW()`,
  );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = crypto.randomBytes(4).toString('hex').toUpperCase();
    const paymentContent = `SEVQR DONATE ${token}`;
    const key = `donate:pending:${token}`;
    const expiresAt = new Date(Date.now() + DONATE_CONFIG.requestExpiryMinutes * 60_000);
    const value = {
      token,
      userId: author.id,
      username: author.username || author.tag || 'Unknown',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    try {
      await pool.query(
        `INSERT INTO ${pgConfig.tables.temp_data} (key, value, expires_at)
         VALUES ($1, $2::jsonb, $3)`,
        [key, JSON.stringify(value), expiresAt],
      );
      return {
        token,
        paymentContent,
        expiresAt,
        qrUrl: createQrUrl(paymentContent),
      };
    } catch (error) {
      if (error.code !== '23505') throw error;
    }
  }

  throw new Error('Could not allocate a unique donation reference.');
}

/**
 * Tạo payload Discord Components V2 và Fallback Embed cho bảng donate.
 * Mỗi lần gọi tạo một mã SEVQR riêng gắn với Discord ID của người gọi.
 */
export function buildDonatePanelPayload(author, request) {
  const container = new ContainerBuilder();
  const qrName = 'Serendipity · Donate QR';

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# ${DONATE_EMOJIS.titleLeft} **CỔNG DONATE** ${DONATE_EMOJIS.titleRight}`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  const bankLines = [
    `${DONATE_EMOJIS.heart} **Ngân hàng:** **${DONATE_CONFIG.bankName}**`,
    `${DONATE_EMOJIS.heart} **Số tài khoản:** \`${DONATE_CONFIG.accountNumber}\` *(Chạm/Click để sao chép)*`,
    `${DONATE_EMOJIS.heart} **Chủ tài khoản:** **${DONATE_CONFIG.accountName}**`,
  ];
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(bankLines.join('\n')));

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  const syntaxLines = [
    `${DONATE_EMOJIS.notice} **Hướng dẫn chuyển khoản:**`,
    '> Quét mã QR bên dưới bằng ứng dụng ngân hàng.',
    '> Số tiền tùy tâm, bạn tự nhập số tiền muốn ủng hộ.',
    `> **Nội dung chuyển khoản:** \`${request.paymentContent}\``,
    `> Mã này được cấp riêng cho <@${author.id}> và có hiệu lực trong **${DONATE_CONFIG.requestExpiryMinutes} phút**.`,
    '> Vui lòng giữ nguyên nội dung chuyển khoản để bot nhận diện và xướng tên chính xác nhé!',
  ];
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(syntaxLines.join('\n')));

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(request.qrUrl)
    )
  );

  const fallbackEmbed = new EmbedBuilder()
    .setColor(0xF2A7C6)
    .setTitle('💖 CỔNG DONATE')
    .setDescription([
      `**Ngân hàng:** ${DONATE_CONFIG.bankName}`,
      `**Số tài khoản:** \`${DONATE_CONFIG.accountNumber}\``,
      `**Chủ tài khoản:** ${DONATE_CONFIG.accountName}`,
      '',
      '**Hướng dẫn chuyển khoản:**',
      '> Quét QR, tự nhập số tiền muốn ủng hộ.',
      `> **Nội dung:** \`${request.paymentContent}\``,
      `> Mã riêng của <@${author.id}> · Hết hạn sau ${DONATE_CONFIG.requestExpiryMinutes} phút.`,
    ].join('\n'))
    .setImage(request.qrUrl);

  return {
    v2: {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { users: [author.id] },
    },
    fallback: {
      embeds: [fallbackEmbed],
      allowedMentions: { users: [author.id] },
    },
  };
}

/**
 * Xử lý keyword &donate. Mỗi lượt gọi cấp một mã QR động riêng.
 */
export async function handleDonateKeyword(message, client) {
  if (!message || !message.content || message.author.bot) return false;
  if (message.content.trim().toLowerCase() !== '&donate') return false;

  try {
    const request = await createDonationRequest(client, message.author);
    const payload = buildDonatePanelPayload(message.author, request);

    try {
      await message.channel.send(payload.v2);
    } catch (v2Error) {
      logger.warn('[Donate] Components V2 send failed, falling back to Embed:', v2Error);
      await message.channel.send(payload.fallback);
    }

    logger.info('[Donate] Created dynamic QR request', {
      userId: message.author.id,
      token: request.token,
      expiresAt: request.expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error('[Donate] Could not create dynamic donation request:', error);
    await message.reply(
      'Hiện tại cổng donate đang tạm thời không tạo được mã thanh toán. Bạn vui lòng thử lại sau nhé!'
    ).catch(() => {});
  }

  return true;
}

function extractDonationToken(content = '') {
  const match = String(content).match(/\bSEVQR\s+DONATE\s+([A-Z0-9]{8})\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Ghi nhận webhook theo transaction ID (idempotent) và ghép mã QR với Discord user.
 * Dùng temp_data đã có trong schema, không cần migration hoặc thay đổi dữ liệu cũ.
 */
async function recordDonationTransaction(client, transaction) {
  const pool = getDonatePool(client);
  if (!pool) throw new Error('PostgreSQL is unavailable while processing SePay transaction.');

  const transactionId = String(transaction.id || transaction.referenceCode || '').trim();
  if (!transactionId) throw new Error('SePay transaction is missing both id and referenceCode.');

  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');

    const transactionKey = `donate:sepay:transaction:${transactionId}`;
    const initialValue = {
      transactionId,
      notificationStatus: 'sending',
      notificationLockedAt: new Date().toISOString(),
    };
    const insertResult = await connection.query(
      `INSERT INTO ${pgConfig.tables.temp_data} (key, value, expires_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [
        transactionKey,
        JSON.stringify(initialValue),
        new Date(Date.now() + 365 * 24 * 60 * 60_000),
      ],
    );

    let storedValue = initialValue;
    if (insertResult.rowCount === 0) {
      const existingResult = await connection.query(
        `SELECT value
         FROM ${pgConfig.tables.temp_data}
         WHERE key = $1
         FOR UPDATE`,
        [transactionKey],
      );
      storedValue = existingResult.rows[0]?.value || {};

      if (storedValue.notificationStatus === 'sent') {
        await connection.query('COMMIT');
        return { duplicate: true, donorId: storedValue.donorId || null, token: storedValue.token || null };
      }

      const lockedAt = Date.parse(storedValue.notificationLockedAt || '');
      const lockIsFresh = storedValue.notificationStatus === 'sending'
        && Number.isFinite(lockedAt)
        && Date.now() - lockedAt < 2 * 60_000;

      if (lockIsFresh) {
        await connection.query('COMMIT');
        return { duplicate: true, donorId: storedValue.donorId || null, token: storedValue.token || null };
      }

      await connection.query(
        `UPDATE ${pgConfig.tables.temp_data}
         SET value = value || $2::jsonb
         WHERE key = $1`,
        [
          transactionKey,
          JSON.stringify({
            notificationStatus: 'sending',
            notificationLockedAt: new Date().toISOString(),
          }),
        ],
      );
    }

    let donorId = storedValue.donorId ? String(storedValue.donorId) : null;
    let token = storedValue.token || extractDonationToken(transaction.content);

    if (!donorId && token) {
      const pendingKey = `donate:pending:${token}`;
      const pendingResult = await connection.query(
        `SELECT value
         FROM ${pgConfig.tables.temp_data}
         WHERE key = $1 AND (expires_at IS NULL OR expires_at > NOW())
         FOR UPDATE`,
        [pendingKey],
      );

      const pending = pendingResult.rows[0]?.value;
      if (pending?.status === 'pending' && pending.userId) {
        donorId = String(pending.userId);

        await connection.query(
          `UPDATE ${pgConfig.tables.temp_data}
           SET value = value || $2::jsonb, expires_at = NULL
           WHERE key = $1`,
          [
            pendingKey,
            JSON.stringify({
              status: 'paid',
              paidAt: new Date().toISOString(),
              transactionId,
              transferAmount: Number(transaction.transferAmount) || 0,
            }),
          ],
        );
      }
    }

    await connection.query(
      `UPDATE ${pgConfig.tables.temp_data}
       SET value = value || $2::jsonb
       WHERE key = $1`,
      [
        transactionKey,
        JSON.stringify({
          donorId,
          token,
          content: transaction.content || '',
          notificationStatus: 'sending',
          notificationLockedAt: new Date().toISOString(),
        }),
      ],
    );

    await connection.query('COMMIT');
    return { duplicate: false, donorId, token, transactionKey };
  } catch (error) {
    await connection.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function updateDonationNotificationStatus(client, transactionKey, status) {
  const pool = getDonatePool(client);
  if (!pool || !transactionKey) return;

  await pool.query(
    `UPDATE ${pgConfig.tables.temp_data}
     SET value = value || $2::jsonb
     WHERE key = $1`,
    [
      transactionKey,
      JSON.stringify({
        notificationStatus: status,
        notificationUpdatedAt: new Date().toISOString(),
      }),
    ],
  );
}

/**
 * Gửi thông báo cảm ơn khi nhận được donate thành công qua Webhook SePay.
 */
export async function sendDonationNotification(client, transaction) {
  const channel = client.channels.cache.get(DONATE_CONFIG.channelId)
    || await client.channels.fetch(DONATE_CONFIG.channelId).catch(() => null);

  if (!channel) {
    logger.error(`[Donate] Could not find channel with ID ${DONATE_CONFIG.channelId}`);
    return false;
  }

  const {
    transferAmount = 0,
    content = '',
    referenceCode = '',
    transactionDate = '',
    gateway = DONATE_CONFIG.bankName,
    id = '',
    donorId = null,
  } = transaction;

  let donorMention = 'Một bạn ẩn danh ✨';
  if (donorId) {
    try {
      const user = await client.users.fetch(String(donorId));
      donorMention = `<@${donorId}> (${user.username})`;
    } catch {
      donorMention = `<@${donorId}>`;
    }
  } else {
    const snowflakeMatch = String(content).match(/\b(\d{17,20})\b/);
    if (snowflakeMatch) {
      const userId = snowflakeMatch[1];
      try {
        const user = await client.users.fetch(userId);
        donorMention = `<@${userId}> (${user.username})`;
      } catch {
        donorMention = `<@${userId}>`;
      }
    } else if (!/SEVQR/i.test(content)) {
      const cleaned = String(content).replace(/^(?:DONATE|CK|UNG HO)\s*/i, '').trim();
      if (cleaned) donorMention = `**${cleaned}**`;
    }
  }

  const formattedAmount = Number(transferAmount).toLocaleString('vi-VN');
  const formattedTime = transactionDate || new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  const container = new ContainerBuilder();
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# ${DONATE_EMOJIS.titleLeft} **NHẬN DONATE THÀNH CÔNG** ${DONATE_EMOJIS.titleRight}`
    )
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  const lines = [
    `${DONATE_EMOJIS.heart} **Người ủng hộ:** ${donorMention}`,
    `${DONATE_EMOJIS.heart} **Số tiền:** **+${formattedAmount} VNĐ**`,
    `${DONATE_EMOJIS.heart} **Nội dung:** \`${content || 'Không có'}\``,
    `${DONATE_EMOJIS.heart} **Ngân hàng:** ${gateway}`,
    `${DONATE_EMOJIS.heart} **Mã giao dịch:** \`${referenceCode || id || 'N/A'}\``,
    `${DONATE_EMOJIS.heart} **Thời gian:** \`${formattedTime}\``,
  ];
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${DONATE_EMOJIS.notice} *Cảm ơn bạn rất nhiều vì đã ủng hộ server! Mọi đóng góp đều là động lực to lớn.*`
    )
  );

  const fallbackEmbed = new EmbedBuilder()
    .setColor(0xF2A7C6)
    .setTitle('🎉 NHẬN DONATE THÀNH CÔNG! 🎉')
    .setDescription([
      `**Người ủng hộ:** ${donorMention}`,
      `**Số tiền:** **+${formattedAmount} VNĐ**`,
      `**Nội dung:** \`${content || 'Không có'}\``,
      `**Ngân hàng:** ${gateway}`,
      `**Mã giao dịch:** \`${referenceCode || id || 'N/A'}\``,
      `**Thời gian:** \`${formattedTime}\``,
      '',
      '*Cảm ơn bạn rất nhiều vì đã ủng hộ server! Mọi đóng góp đều là động lực to lớn.*',
    ].join('\n'))
    .setTimestamp();

  try {
    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: donorId ? { users: [String(donorId)] } : { parse: [] },
    });
    logger.info('[Donate] Sent donation notification', {
      transactionId: String(id || referenceCode || ''),
      transferAmount: Number(transferAmount) || 0,
      donorId,
    });
    return true;
  } catch (v2Error) {
    logger.warn('[Donate] Failed to send V2 notification, falling back to Embed:', v2Error);
    try {
      await channel.send({
        embeds: [fallbackEmbed],
        allowedMentions: donorId ? { users: [String(donorId)] } : { parse: [] },
      });
      return true;
    } catch (fallbackError) {
      logger.error('[Donate] Failed to send fallback notification embed:', fallbackError);
      return false;
    }
  }
}

/**
 * Đăng ký endpoint Webhook SePay lên Express App.
 */
export function setupDonateWebhook(app, client) {
  app.post('/webhook/sepay', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || req.headers['x-api-key'] || '';
      const expectedKey = DONATE_CONFIG.sepayApiKey;
      const match = String(authHeader).match(/^(?:Apikey|Bearer)\s+(.+)$/i);
      const token = match ? match[1].trim() : String(authHeader).trim();

      if (expectedKey && token !== expectedKey.trim()) {
        logger.warn('[Donate Webhook] Unauthorized request received', { ip: req.ip });
        return res.status(401).json({ success: false, message: 'Unauthorized API Key' });
      }

      const body = req.body;
      if (!body || Object.keys(body).length === 0) {
        return res.status(200).json({ success: true });
      }

      if (body.event === 'test' || body.test === true) {
        logger.info('[Donate Webhook] Received SePay test ping event');
        return res.status(200).json({ success: true });
      }

      const transactions = Array.isArray(body) ? body : [body];
      const expectedAccount = DONATE_CONFIG.accountNumber.replace(/\D/g, '');

      for (const tx of transactions) {
        if (tx.transferType !== 'in' || Number(tx.transferAmount) <= 0) {
          logger.debug('[Donate Webhook] Skipping non-incoming transaction');
          continue;
        }

        const actualAccount = String(tx.accountNumber || '').replace(/\D/g, '');
        if (actualAccount && actualAccount !== expectedAccount) {
          logger.info('[Donate Webhook] Skipping transaction from another account', {
            accountNumber: tx.accountNumber,
          });
          continue;
        }

        const recorded = await recordDonationTransaction(client, tx);
        if (recorded.duplicate) {
          logger.info('[Donate Webhook] Ignoring duplicate or currently processing SePay transaction', {
            transactionId: String(tx.id || tx.referenceCode || ''),
          });
          continue;
        }

        const sent = await sendDonationNotification(client, {
          ...tx,
          donorId: recorded.donorId,
        });

        await updateDonationNotificationStatus(
          client,
          recorded.transactionKey,
          sent ? 'sent' : 'pending',
        );

        if (!sent) {
          logger.error('[Donate Webhook] Discord notification failed; SePay may retry this transaction', {
            transactionId: String(tx.id || tx.referenceCode || ''),
            donorId: recorded.donorId,
          });
          return res.status(500).json({ success: false, message: 'Discord notification failed' });
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error('[Donate Webhook] Error processing webhook:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  logger.info('✅ SePay Webhook route mounted at POST /webhook/sepay');
}
