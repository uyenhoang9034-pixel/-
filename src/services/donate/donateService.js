import fs from 'fs';
import path from 'path';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { logger } from '../../utils/logger.js';

export const DONATE_CONFIG = {
  bankName: process.env.DONATE_BANK_NAME || 'Vietinbank',
  accountNumber: process.env.DONATE_ACCOUNT_NUMBER || '109872322675',
  accountName: process.env.DONATE_ACCOUNT_NAME || 'Hoàng Uyên',
  channelId: process.env.DONATE_CHANNEL_ID || '1567185361900413089',
  sepayApiKey: process.env.SEPAY_API_KEY || 'serendipity_sepay_key_99',
  qrImagePath: path.join(process.cwd(), 'assets', 'donate', 'donation.png'),
};

export const DONATE_EMOJIS = {
  titleLeft: '<a:trangtrig2:1546040703375904801>',
  titleRight: '<a:trangtrig3:1546040818261954610>',
  heart: '<a:heartg1:1545307544808071258>',
  notice: '<a:bang2:1546891483250954290>',
};

/**
 * Tạo payload Discord Components V2 và Fallback Embed cho bảng thông tin donate (&donate)
 */
export function buildDonatePanelPayload(author) {
  const container = new ContainerBuilder();

  // 1. Tiêu đề
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# ${DONATE_EMOJIS.titleLeft} **CỔNG DONATE** ${DONATE_EMOJIS.titleRight}`
    )
  );

  // Đường kẻ 1
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // 2. Thông tin ngân hàng
  const bankLines = [
    `${DONATE_EMOJIS.heart} **Ngân hàng:** **${DONATE_CONFIG.bankName}**`,
    `${DONATE_EMOJIS.heart} **Số tài khoản:** \`${DONATE_CONFIG.accountNumber}\` *(Chạm/Click để sao chép)*`,
    `${DONATE_EMOJIS.heart} **Chủ tài khoản:** **${DONATE_CONFIG.accountName}**`,
  ];

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(bankLines.join('\n'))
  );

  // Đường kẻ 2
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // 3. Hướng dẫn chuyển khoản
  const userSyntaxNote = author?.id ? `\n> *(Nếu muốn bot xướng tên, bạn có thể kèm thêm ID: \`${author.id}\` vào nội dung CK)*` : '';
  const syntaxLines = [
    `${DONATE_EMOJIS.notice} **Hướng dẫn chuyển khoản:**`,
    `> Quét mã QR bên dưới để chuyển khoản.`,
    `> *Bạn nhớ check kĩ trước khi chuyển khoản nhé!*${userSyntaxNote}`,
  ];

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(syntaxLines.join('\n'))
  );

  // Đường kẻ 3
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // 4. Đính kèm ảnh mã QR
  const filesV2 = [];
  const filesFallback = [];
  if (fs.existsSync(DONATE_CONFIG.qrImagePath)) {
    filesV2.push(new AttachmentBuilder(DONATE_CONFIG.qrImagePath, { name: 'donation.png' }));
    filesFallback.push(new AttachmentBuilder(DONATE_CONFIG.qrImagePath, { name: 'donation.png' }));
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL('attachment://donation.png')
      )
    );
  }

  // Fallback Embed truyền thống phòng khi Discord client chưa hiển thị V2
  const fallbackEmbed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('💖 CỔNG DONATE')
    .setDescription([
      `**Ngân hàng:** **${DONATE_CONFIG.bankName}**`,
      `**Số tài khoản:** \`${DONATE_CONFIG.accountNumber}\``,
      `**Chủ tài khoản:** **${DONATE_CONFIG.accountName}**`,
      '',
      `**Hướng dẫn chuyển khoản:**`,
      `> Quét mã QR bên dưới để chuyển khoản.`,
      `> *Bạn nhớ check kĩ trước khi chuyển khoản nhé!*`,
    ].join('\n'));

  if (filesFallback.length > 0) {
    fallbackEmbed.setImage('attachment://donation.png');
  }

  return {
    v2: {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      files: filesV2.length > 0 ? filesV2 : undefined,
    },
    fallback: {
      embeds: [fallbackEmbed],
      files: filesFallback.length > 0 ? filesFallback : undefined,
    },
  };
}

/**
 * Xử lý keyword tin nhắn &donate
 */
export async function handleDonateKeyword(message, client) {
  if (!message || !message.content || message.author.bot) {
    return false;
  }

  const content = message.content.trim().toLowerCase();
  if (content !== '&donate') {
    return false;
  }

  const payload = buildDonatePanelPayload(message.author);

  try {
    await message.channel.send(payload.v2);
    logger.info(`[Donate] Sent donate panel to ${message.author.tag} in #${message.channel.name || message.channel.id}`);
  } catch (err) {
    logger.warn('[Donate] Components V2 send failed, falling back to Embed:', err);
    try {
      await message.channel.send(payload.fallback);
    } catch (fallbackErr) {
      logger.error('[Donate] Failed to send fallback embed:', fallbackErr);
    }
  }

  return true;
}

/**
 * Gửi thông báo cảm ơn khi nhận được donate thành công qua Webhook SePay
 */
export async function sendDonationNotification(client, transaction) {
  const channel = client.channels.cache.get(DONATE_CONFIG.channelId) || 
                  await client.channels.fetch(DONATE_CONFIG.channelId).catch(() => null);

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
  } = transaction;

  // Tìm ID người dùng Discord nếu có trong nội dung chuyển khoản (dạng 17-20 chữ số)
  const snowflakeMatch = String(content).match(/\b(\d{17,20})\b/);
  let donorMention = 'Một bạn ẩn danh ✨';
  if (snowflakeMatch) {
    const userId = snowflakeMatch[1];
    try {
      const user = await client.users.fetch(userId);
      donorMention = `<@${userId}> (${user.username})`;
    } catch {
      donorMention = `<@${userId}>`;
    }
  } else {
    // Nếu nội dung chỉ là mã hệ thống SePay (ví dụ chứa SEVQR), hiển thị Một bạn ẩn danh
    // Nếu có tên người dùng custom thì hiển thị
    const isSePaySystemSyntax = /SEVQR/i.test(content);
    if (!isSePaySystemSyntax) {
      const cleaned = String(content).replace(/^(?:DONATE|CK|UNG HO)\s*/i, '').trim();
      if (cleaned) {
        donorMention = `**${cleaned}**`;
      }
    }
  }

  const formattedAmount = Number(transferAmount).toLocaleString('vi-VN');
  const formattedTime = transactionDate || new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  // 1. Container V2
  const container = new ContainerBuilder();

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# ${DONATE_EMOJIS.titleLeft} **NHẬN DONATE THÀNH CÔNG** ${DONATE_EMOJIS.titleRight}`
    )
  );

  // Đường kẻ 1
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // Dòng thông tin
  const lines = [
    `${DONATE_EMOJIS.heart} **Người ủng hộ:** ${donorMention}`,
    `${DONATE_EMOJIS.heart} **Số tiền:** **+${formattedAmount} VNĐ**`,
    `${DONATE_EMOJIS.heart} **Nội dung:** \`${content || 'Không có'}\``,
    `${DONATE_EMOJIS.heart} **Ngân hàng:** ${gateway}`,
    `${DONATE_EMOJIS.heart} **Mã giao dịch:** \`${referenceCode || id || 'N/A'}\``,
    `${DONATE_EMOJIS.heart} **Thời gian:** \`${formattedTime}\``,
  ];

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join('\n'))
  );

  // Đường kẻ 2
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // Lời cảm ơn
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${DONATE_EMOJIS.notice} *Cảm ơn bạn rất nhiều vì đã ủng hộ server! Mọi đóng góp đều là động lực to lớn.*`
    )
  );

  // Fallback Embed
  const fallbackEmbed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle(`🎉 NHẬN DONATE THÀNH CÔNG! 🎉`)
    .setDescription([
      `**Người ủng hộ:** ${donorMention}`,
      `**Số tiền:** **+${formattedAmount} VNĐ**`,
      `**Nội dung:** \`${content || 'Không có'}\``,
      `**Ngân hàng:** ${gateway}`,
      `**Mã giao dịch:** \`${referenceCode || id || 'N/A'}\``,
      `**Thời gian:** \`${formattedTime}\``,
      '',
      `*Cảm ơn bạn rất nhiều vì đã ủng hộ server! Mọi đóng góp đều là động lực to lớn.*`,
    ].join('\n'))
    .setTimestamp();

  try {
    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    logger.info(`[Donate] Sent donation notification for ${formattedAmount} VNĐ to channel ${channel.id}`);
    return true;
  } catch (v2Err) {
    logger.warn('[Donate] Failed to send V2 notification, falling back to Embed:', v2Err);
    try {
      await channel.send({ embeds: [fallbackEmbed] });
      return true;
    } catch (fallbackErr) {
      logger.error('[Donate] Failed to send fallback notification embed:', fallbackErr);
      return false;
    }
  }
}

/**
 * Đăng ký endpoint Webhook SePay lên Express App
 */
export function setupDonateWebhook(app, client) {
  app.post('/webhook/sepay', async (req, res) => {
    try {
      const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || '';
      const expectedKey = DONATE_CONFIG.sepayApiKey;

      const match = authHeader.match(/^(?:Apikey|Bearer)\s+(.+)$/i);
      const token = match ? match[1].trim() : authHeader.trim();

      if (expectedKey && token !== expectedKey.trim()) {
        logger.warn('[Donate Webhook] Unauthorized request received', {
          authHeader,
          ip: req.ip,
        });
        return res.status(401).json({ success: false, message: 'Unauthorized API Key' });
      }

      const body = req.body;
      if (!body || Object.keys(body).length === 0) {
        return res.status(200).json({ success: true, message: 'Endpoint active' });
      }

      // Xử lý sự kiện kiểm tra ping / test từ SePay
      if (body.event === 'test' || body.test === true) {
        logger.info('[Donate Webhook] Received SePay test ping event');
        return res.status(200).json({ success: true, message: 'Test received' });
      }

      const transactions = Array.isArray(body) ? body : [body];

      for (const tx of transactions) {
        if (tx.transferType === 'in' && Number(tx.transferAmount) > 0) {
          await sendDonationNotification(client, tx);
        } else {
          logger.debug('[Donate Webhook] Skipping non-incoming transaction', tx);
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
