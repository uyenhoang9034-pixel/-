import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} from 'discord.js';

import {
  ROLE_ICON_ITEMS,
  ROLE_ICON_DONOR_ROLE_ID,
  ROLE_ICON_EMOJIS,
  ALL_ROLE_ICON_ROLE_IDS,
  getRoleIconAssetPath,
  getRoleIconById,
  parseRoleIconInput,
} from '../config/roleIconShopConfig.js';

import { getPersonalTotal } from './financial/financialLedgerService.js';
import { logger } from '../utils/logger.js';

const inMemoryOwnership = new Map();

function getPool(client) {
  const database = client?.db?.db;
  if (!database || typeof database.isAvailable !== 'function' || !database.isAvailable()) return null;
  return database.pool;
}

export async function initRoleIconStorage(client) {
  const pool = getPool(client);
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_icon_ownership (
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        owned_icons JSONB NOT NULL DEFAULT '[]',
        active_icon INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id)
      );
    `);
    logger.info('🔮 [RoleIconShop] Bảng cơ sở dữ liệu role_icon_ownership đã sẵn sàng.');
  } catch (err) {
    logger.warn('⚠️ [RoleIconShop] Không thể khởi tạo bảng role_icon_ownership (dùng in-memory fallback):', err);
  }
}

export function isServerOwner(member, guild) {
  if (!member || !guild) return false;
  if (member.id === guild.ownerId) return true;
  const configuredOwnerIds = (process.env.OWNER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (configuredOwnerIds.includes(member.id)) return true;
  return false;
}

export async function getUserOwnership(guildId, userId, client) {
  const pool = getPool(client);
  if (pool) {
    try {
      const res = await pool.query(
        'SELECT owned_icons, active_icon FROM role_icon_ownership WHERE guild_id = $1 AND user_id = $2',
        [guildId, userId]
      );
      if (res.rows.length > 0) {
        return {
          owned_icons: Array.isArray(res.rows[0].owned_icons) ? res.rows[0].owned_icons : [],
          active_icon: res.rows[0].active_icon ?? null,
        };
      }
    } catch (err) {
      logger.warn('[RoleIconShop] Lỗi đọc ownership từ DB, fallback in-memory:', err);
    }
  }

  const key = `${guildId}:${userId}`;
  if (!inMemoryOwnership.has(key)) {
    inMemoryOwnership.set(key, { owned_icons: [], active_icon: null });
  }
  return inMemoryOwnership.get(key);
}

export async function saveUserOwnership(guildId, userId, data, client) {
  const pool = getPool(client);
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO role_icon_ownership (guild_id, user_id, owned_icons, active_icon, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (guild_id, user_id)
         DO UPDATE SET owned_icons = $3, active_icon = $4, updated_at = CURRENT_TIMESTAMP`,
        [guildId, userId, JSON.stringify(data.owned_icons), data.active_icon]
      );
    } catch (err) {
      logger.warn('[RoleIconShop] Lỗi lưu ownership vào DB, fallback in-memory:', err);
    }
  }

  const key = `${guildId}:${userId}`;
  inMemoryOwnership.set(key, data);
}

export function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' VNĐ';
}

/**
 * =========================================================
 * BẢNG SHOP V2 CỐ ĐỊNH (PERSISTENT PANEL)
 * =========================================================
 */
export function buildMainShopContainer() {
  const container = new ContainerBuilder();

  // 1. Tiêu đề chính
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# ${ROLE_ICON_EMOJIS.headerLeft} **TIỆM ROLE ICON USAGI** ${ROLE_ICON_EMOJIS.headerRight}`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // 2. Nội dung giới thiệu và cơ chế
  const desc = [
    `Dạ em bot Usagi múp rụp chào mừng các nhà hảo tâm đã ủng hộ cho sự phát triển của máy chủ! ${ROLE_ICON_EMOJIS.welcome}\n`,
    `${ROLE_ICON_EMOJIS.ruleTitle} **CƠ CHẾ QUY ĐỔI ROLE ICON ĐỘC QUYỀN:**`,
    `${ROLE_ICON_EMOJIS.bullet} Cứ mỗi **20.000 VNĐ** đã donate cho server (được ghi nhận qua BQT của server), bạn sẽ đổi được **1 Role Icon**.`,
    `${ROLE_ICON_EMOJIS.bullet} Riêng mẫu đặc biệt **Rune Affinity (#01)** yêu cầu mốc tích lũy từ **100.000 VNĐ** trở lên.`,
    `${ROLE_ICON_EMOJIS.bullet} Lần đầu tiên bạn donate, bot đã tự động cấp Role Đặc Quyền <@&${ROLE_ICON_DONOR_ROLE_ID}> để bạn mở khóa kênh bí mật này.`,
    `${ROLE_ICON_EMOJIS.bullet} Để đổi icon, bạn chỉ cần chat cú pháp lệnh ngay tại kênh này: \`&roleicon +emoji\``,
    `${ROLE_ICON_EMOJIS.warning} **Lưu ý:** Chỉ đổi được các Role Icon bên dưới đây thôi ạ!`,
  ].join('\n');

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(desc));

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // 3. Danh sách 10 mẫu icon
  const itemsText = ROLE_ICON_ITEMS.map((item) => {
    const specialTag = item.isSpecial ? ` ${ROLE_ICON_EMOJIS.crown} *(Mốc 100k Donate)*` : ' *(20k Donate)*';
    return `> • **#${item.padId}** ${item.emoji} **${item.name}**${specialTag}`;
  }).join('\n');

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ROLE_ICON_EMOJIS.roleEmojiTag} **DANH MỤC 10 ROLE ICON CHÍNH THỨC:**\n${itemsText}`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // 4. Select menu
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('roleicon_select')
    .setPlaceholder('Bấm vào đây để chọn 1 trong 10 mẫu Role Icon...')
    .addOptions(
      ROLE_ICON_ITEMS.map((item) => ({
        label: `#${item.padId} ${item.name}`,
        description: item.isSpecial ? 'Mốc tích lũy tối thiểu 100.000 VNĐ' : 'Quy đổi 1 suất 20.000 VNĐ',
        value: String(item.id),
        emoji: { id: item.emojiId },
      }))
    );

  // 5. Nút bấm full xám (Secondary)
  const buttonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('roleicon_btn_guide')
      .setLabel('Hướng Dẫn Dùng Lệnh')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: '1567819562320134234' }),
    new ButtonBuilder()
      .setCustomId('roleicon_btn_wardrobe')
      .setLabel('Tủ Role Icon')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: '1567819562320134234' })
  );

  container.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));
  container.addActionRowComponents(buttonsRow);

  return container;
}

/**
 * =========================================================
 * BẢNG PANEL TỰ ĐỘNG GHIM CUỐI KÊNH (STICKY BOTTOM PANEL)
 * =========================================================
 */
let isPanelRefreshing = false;
let pendingPanelRefresh = false;
const cachedShopPanelMessageIds = new Map();
const cachedShopChannelIds = new Map();

export async function getShopChannelId(guildId, client) {
  if (!guildId) return null;
  if (cachedShopChannelIds.has(guildId)) {
    return cachedShopChannelIds.get(guildId);
  }
  if (client?.db?.get) {
    const saved = await client.db.get(`roleicon:channel:${guildId}`, null).catch(() => null);
    if (saved) {
      cachedShopChannelIds.set(guildId, saved);
      return saved;
    }
  }
  return null;
}

export async function isRoleIconShopChannelAsync(guildId, channelId, client) {
  if (!guildId || !channelId) return false;
  const targetId = await getShopChannelId(guildId, client);
  return targetId === channelId;
}

export async function refreshRoleIconShopPanel(client, guild, targetChannel = null) {
  if (!guild) return;
  if (isPanelRefreshing) {
    pendingPanelRefresh = true;
    return;
  }
  isPanelRefreshing = true;

  try {
    let channel = targetChannel;
    if (!channel) {
      const channelId = await getShopChannelId(guild.id, client);
      if (channelId) {
        channel =
          guild.channels.cache.get(channelId) ||
          (await guild.channels.fetch(channelId).catch(() => null));
      }
    }

    if (!channel || !channel.isTextBased()) {
      logger.warn('[RoleIconShop] Kênh shop không tìm thấy hoặc không phải text-based.');
      return;
    }

    // Cập nhật cache & DB kênh shop
    cachedShopChannelIds.set(guild.id, channel.id);
    if (client?.db?.set) {
      await client.db.set(`roleicon:channel:${guild.id}`, channel.id).catch(() => {});
    }

    // 1. Xóa panel cũ theo ID đã lưu
    let savedPanelId = cachedShopPanelMessageIds.get(guild.id);
    if (!savedPanelId && client?.db?.get) {
      savedPanelId = await client.db.get(`roleicon:panel:${guild.id}`, null).catch(() => null);
    }
    if (savedPanelId) {
      await channel.messages.delete(savedPanelId).catch(() => {});
    }

    // 2. Quét dọn các panel shop cũ của bot trong 25 tin nhắn gần nhất
    const recentMessages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
    if (recentMessages) {
      for (const msg of recentMessages.values()) {
        if (msg.author?.id !== client.user?.id) continue;

        let compsString = '';
        try {
          compsString = JSON.stringify(msg.components ?? []);
        } catch {
          compsString = '';
        }

        const isShopPanel =
          compsString.includes('roleicon_select') ||
          compsString.includes('roleicon_btn_guide') ||
          compsString.includes('roleicon_btn_wardrobe');

        if (isShopPanel) {
          await msg.delete().catch(() => {});
        }
      }
    }

    // 3. Gửi panel mới nhất xuống đáy kênh
    const shopContainer = buildMainShopContainer();
    let newPanelMsg = null;
    try {
      newPanelMsg = await channel.send({
        components: [shopContainer],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (v2Err) {
      logger.warn('[RoleIconShop] Lỗi khi gửi panel V2, gửi fallback:', v2Err);
      newPanelMsg = await channel
        .send({
          components: [shopContainer],
        })
        .catch(() => null);
    }

    if (newPanelMsg) {
      cachedShopPanelMessageIds.set(guild.id, newPanelMsg.id);
      if (client?.db?.set) {
        await client.db.set(`roleicon:panel:${guild.id}`, newPanelMsg.id).catch(() => {});
      }
    }
  } catch (err) {
    logger.error('[RoleIconShop] Lỗi trong quá trình làm mới shop panel:', err);
  } finally {
    isPanelRefreshing = false;
    if (pendingPanelRefresh) {
      pendingPanelRefresh = false;
      await refreshRoleIconShopPanel(client, guild, targetChannel);
    }
  }
}

/**
 * =========================================================
 * CHI TIẾT MẪU ICON V2 (EPHEMERAL - NO TITLE, FULL XÁM)
 * =========================================================
 */
export function buildDetailEphemeral(iconId, member) {
  const item = getRoleIconById(iconId);
  if (!item) return null;

  const container = new ContainerBuilder();
  const filePath = getRoleIconAssetPath(item.file);
  const attachment = new AttachmentBuilder(filePath, { name: `${item.file}` });

  // Ảnh to rõ bo góc V2
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setURL(`attachment://${item.file}`)
        .setDescription(item.name)
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  const crownText = item.isSpecial ? `${ROLE_ICON_EMOJIS.crown} ` : '';
  const priceDesc = item.isSpecial
    ? `${ROLE_ICON_EMOJIS.crown} Tích lũy tối thiểu **100.000 VNĐ**`
    : `${ROLE_ICON_EMOJIS.donate} Tích lũy **20.000 VNĐ** (1 suất)`;

  const lines = [
    `> ${crownText}**Mẫu #${item.padId}: ${item.name}** ──── [${priceDesc}]`,
    `> ${ROLE_ICON_EMOJIS.roleIdTag} **Role ID sẽ cấp:** \`${item.roleId}\``,
    `> ${ROLE_ICON_EMOJIS.roleEmojiTag} **Role Emoji:** ${item.emoji}`,
    `> ${ROLE_ICON_EMOJIS.cmdTag} **Cú pháp chat đổi icon:** \`&roleicon +roleicon${item.id}\``,
    '',
    `**Hiển thị mẫu khi chat:**`,
    `> [${member.displayName}] ${item.emoji} : Chào cả nhà nè, icon ${item.name} xinh quá! ${ROLE_ICON_EMOJIS.heart}`,
    '',
    `*Bạn chỉ cần gõ &roleicon +roleicon${item.id} tại thanh chat kênh nhé!*`,
  ].join('\n');

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));

  return {
    components: [container],
    files: [attachment],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  };
}

/**
 * =========================================================
 * HƯỚNG DẪN DÙNG LỆNH V2 (NO TITLE, FULL XÁM)
 * =========================================================
 */
export function buildGuideContainer() {
  const container = new ContainerBuilder();

  const lines = [
    `### ${ROLE_ICON_EMOJIS.info} **HƯỚNG DẪN SỬ DỤNG LỆNH ĐỔI ROLE ICON**`,
    '',
    `**Bước 1: Kiểm tra hạn mức donate của bạn**`,
    `• Cứ mỗi **20.000 VNĐ** bạn ủng hộ cho máy chủ được tính là **1 suất đổi icon**.`,
    `• Riêng mẫu Thượng Hạng **Rune Affinity (#01)** yêu cầu tổng donate tích lũy tối thiểu **100.000 VNĐ**.`,
    '',
    `**Bước 2: Chọn mẫu icon yêu thích trong 10 mẫu**`,
    `Xem danh mục từ \`#01 Rune Affinity\` đến \`#10 Emblem Essence\` ở bảng shop phía trên.`,
    '',
    `**Bước 3: Gõ lệnh ngay tại thanh chat của kênh này**`,
    `\`&roleicon +emoji\``,
    `*Ví dụ:* \`&roleicon +roleicon1\` hoặc \`&roleicon +1\` hoặc thả emoji \`<:roleicon1:1568117364858421329>\``,
    '',
    `**Bước 4: Nhận Role Icon lập tức!**`,
    `Bot Usagi múp rụp sẽ kiểm tra điều kiện, tự động cấp Role tương ứng và gắn Icon đó lên tên của bạn trong toàn server.`,
  ].join('\n');

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  };
}

/**
 * =========================================================
 * TỦ ROLE ICON V2 (NO TITLE, FULL XÁM)
 * =========================================================
 */
export async function buildWardrobeContainer(member, guild, client) {
  const container = new ContainerBuilder();
  const isOwner = isServerOwner(member, guild);
  const ownership = await getUserOwnership(guild.id, member.id, client);
  let totalDonated = 0;
  if (isOwner) {
    totalDonated = 99999999;
  } else {
    try {
      totalDonated = await getPersonalTotal(client, guild.id, member.id);
    } catch {
      totalDonated = 0;
    }
  }

  const quota = Math.floor(totalDonated / 20000);
  const ownedCount = ownership.owned_icons.length;
  const remaining = isOwner ? 'Vô hạn (Chủ Server)' : Math.max(0, quota - ownedCount);

  const ownedItems = ownership.owned_icons
    .map((id) => getRoleIconById(id))
    .filter(Boolean);

  const ownedListText =
    ownedItems.length > 0
      ? ownedItems
          .map((item) => {
            const isEquipped = ownership.active_icon === item.id;
            const status = isEquipped ? `${ROLE_ICON_EMOJIS.equipped} **Đang đeo trên tên**` : 'Trong kho';
            return `> • ${item.emoji} **${item.name} (#${item.padId})** ──── ${status}`;
          })
          .join('\n')
      : '> *(Hiện tại bạn chưa sở hữu mẫu icon nào trong kho)*';

  const donateInfo = isOwner
    ? `${ROLE_ICON_EMOJIS.account} **Tài khoản:** Chủ Server *(Toàn quyền sử dụng mọi icon để kiểm tra)*`
    : `${ROLE_ICON_EMOJIS.account} **Tài khoản:** <@${member.id}>\n${ROLE_ICON_EMOJIS.bullet} **Đã donate:** **${formatMoney(totalDonated)}**\n${ROLE_ICON_EMOJIS.bullet} **Hạn mức:** Đã dùng **${ownedCount} / ${quota} suất** (Còn dư **${remaining} suất**)`;

  const lines = [
    `### ${ROLE_ICON_EMOJIS.usagi} **TỦ ROLE ICON CỦA BẠN**`,
    '',
    donateInfo,
    '',
    `**Danh sách icon đã sở hữu:**`,
    ownedListText,
    '',
    `*Bạn có thể gõ \`&roleicon +emoji\` của icon đã sở hữu để đổi qua lại hoàn toàn miễn phí 0 VNĐ!*`,
  ].join('\n');

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  };
}

/**
 * =========================================================
 * XỬ LÝ LỆNH CHAT &ROLEICON (NO TITLE, FULL XÁM, V2 CONTAINER)
 * =========================================================
 */
export async function handleRoleIconPrefix(message, client) {
  const content = String(message.content || '').trim();
  if (!/^&roleicon(?:\s|$)/i.test(content)) return false;

  const rawArg = content.replace(/^&roleicon\s*/i, '').trim();

  // Helper phản hồi và tự động đưa bảng Tiệm Role Icon xuống đáy kênh (Sticky Bottom)
  const sendReplyAndRefresh = async (container) => {
    try {
      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch {
      await message.reply({ components: [container] }).catch(() => {});
    }
    await refreshRoleIconShopPanel(client, message.guild, message.channel).catch((err) => {
      logger.error('[RoleIconShop] Lỗi refresh panel sau khi reply:', err);
    });
    return true;
  };

  // 1. Kiểm tra quyền sở hữu của Chủ Server
  const isOwner = isServerOwner(message.member, message.guild);

  // 2. Kiểm tra Role Đặc Quyền (trừ Chủ Server)
  if (!isOwner) {
    const hasDonorRole = message.member?.roles?.cache?.has(ROLE_ICON_DONOR_ROLE_ID);
    if (!hasDonorRole) {
      const container = new ContainerBuilder();
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `> ${ROLE_ICON_EMOJIS.error} Bạn chưa sở hữu Role Đặc Quyền <@&${ROLE_ICON_DONOR_ROLE_ID}>!\n` +
          `> Kênh tiệm và lệnh đổi Role Icon chỉ dành riêng cho các thành viên đã từng ủng hộ cho sự phát triển của máy chủ.\n` +
          `> Vui lòng liên hệ BQT để được ghi nhận donate trước khi sử dụng tiệm nhé ${ROLE_ICON_EMOJIS.heart}`
        )
      );
      return sendReplyAndRefresh(container);
    }
  }

  // 3. Nếu không nhập đối số -> Hướng dẫn cú pháp
  if (!rawArg) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `> ${ROLE_ICON_EMOJIS.info} **Cú pháp:** \`&roleicon +emoji\` hoặc \`&roleicon +roleicon[1-10]\`\n` +
        `> *Ví dụ:* \`&roleicon +roleicon1\` hoặc \`&roleicon +1\` hoặc thả emoji \`<:roleicon1:1568117364858421329>\`\n` +
        `> Bạn vui lòng xem bảng danh mục 10 icon phía trên để chọn mẫu muốn đổi nhé!`
      )
    );
    return sendReplyAndRefresh(container);
  }

  // 4. Nhận diện icon hợp lệ
  const targetItem = parseRoleIconInput(rawArg);
  if (!targetItem) {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `> ${ROLE_ICON_EMOJIS.error} Emoji hoặc cú pháp không hợp lệ! Bot chỉ chấp nhận **10 Role Icon chính thức** trong album assets của server thôi ạ.\n\n` +
        `> **Cú pháp hợp lệ bạn có thể dùng:**\n` +
        `> • \`&roleicon +roleicon1\` đến \`+roleicon10\`\n` +
        `> • \`&roleicon +1\` đến \`+10\`\n` +
        `> • Hoặc thả trực tiếp emoji roleicon chính thức từ menu Discord!`
      )
    );
    return sendReplyAndRefresh(container);
  }

  // 5. Đọc dữ liệu sở hữu
  const guildId = message.guild.id;
  const userId = message.author.id;
  const ownership = await getUserOwnership(guildId, userId, client);

  // 6. Trường hợp ĐÃ SỞ HỮU TRƯỚC ĐÓ -> Đổi lại miễn phí (Re-equip)
  if (ownership.owned_icons.includes(targetItem.id)) {
    try {
      // Tháo các role icon khác trong 10 role icon
      const rolesToRemove = ALL_ROLE_ICON_ROLE_IDS.filter((id) => id !== targetItem.roleId);
      await message.member.roles.remove(rolesToRemove).catch(() => null);
      await message.member.roles.add(targetItem.roleId, 'Trang bị Role Icon từ Tủ Đồ').catch(() => null);

      ownership.active_icon = targetItem.id;
      await saveUserOwnership(guildId, userId, ownership, client);

      const container = new ContainerBuilder();
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `> ${ROLE_ICON_EMOJIS.success} Đã chuyển sang trang bị **${targetItem.name} (#${targetItem.padId})** ${targetItem.emoji} thành công!\n` +
          `> ${ROLE_ICON_EMOJIS.info} **Chi phí:** **0 VNĐ (Miễn phí)** do bạn đã sở hữu vĩnh viễn trước đó.\n` +
          `> ${ROLE_ICON_EMOJIS.roleIdTag} Role icon mới đã lập tức xuất hiện bên cạnh tên bạn trong mọi khung chat server rồi nè! ${ROLE_ICON_EMOJIS.heart}`
        )
      );
      return sendReplyAndRefresh(container);
    } catch (err) {
      logger.error('[RoleIconShop] Lỗi re-equip role icon:', err);
      return true;
    }
  }

  // 7. MUA MỚI: Kiểm tra số dư & hạn mức donate (trừ Chủ Server)
  const totalDonated = isOwner ? 99999999 : await getPersonalTotal(client, guildId, userId);

  if (!isOwner) {
    // 7.1. Kiểm tra mốc 100k riêng cho Icon #01 (Rune Affinity)
    if (targetItem.isSpecial && totalDonated < 100000) {
      const container = new ContainerBuilder();
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `> ${ROLE_ICON_EMOJIS.crown} Mẫu **Rune Affinity (#01)** là Role Icon Thượng Hạng độc quyền yêu cầu điều kiện đặc biệt!\n` +
          `> ${ROLE_ICON_EMOJIS.crown} **Điều kiện bắt buộc:** Tổng số tiền donate tích lũy phải đạt từ **100.000 VNĐ** trở lên.\n` +
          `> ${ROLE_ICON_EMOJIS.bullet} **Tiến độ hiện tại của bạn:** **${formatMoney(totalDonated)}** / **100.000 VNĐ**\n` +
          `> ${ROLE_ICON_EMOJIS.warning} **Còn thiếu:** **${formatMoney(100000 - totalDonated)}** để mở khóa biểu tượng quyền lực này.\n\n` +
          `> Bạn có thể chọn đổi trước các mẫu #02 đến #10 (chỉ cần 20k) hoặc tích lũy thêm để rước Rune Affinity nha! ${ROLE_ICON_EMOJIS.heart}`
        )
      );
      return sendReplyAndRefresh(container);
    }

    // 7.2. Kiểm tra hạn mức chung (Cứ 20k = 1 suất)
    const totalSlotsEarned = Math.floor(totalDonated / 20000);
    const slotsUsed = ownership.owned_icons.length;

    if (slotsUsed >= totalSlotsEarned) {
      const container = new ContainerBuilder();
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `> ${ROLE_ICON_EMOJIS.error} Bạn chưa đủ hạn mức donate để đổi thêm Role Icon mới!\n` +
          `> ${ROLE_ICON_EMOJIS.bullet} **Tổng donate tích lũy:** **${formatMoney(totalDonated)}** (tương đương **${totalSlotsEarned} suất**)\n` +
          `> ${ROLE_ICON_EMOJIS.bullet} **Số icon đã đổi:** **${slotsUsed} icon** (Đã dùng hết ${slotsUsed} / ${totalSlotsEarned} suất)\n` +
          `> ${ROLE_ICON_EMOJIS.warning} **Khoản còn thiếu:** Bạn cần donate thêm tối thiểu **20.000 VNĐ** để nhận thêm 1 suất đổi icon mới nhé!`
        )
      );
      return sendReplyAndRefresh(container);
    }
  }

  // 8. ĐỦ ĐIỀU KIỆN HOẶC CHỦ SERVER -> CẤP ROLE VÀ GẮN ICON
  try {
    const rolesToRemove = ALL_ROLE_ICON_ROLE_IDS.filter((id) => id !== targetItem.roleId);
    await message.member.roles.remove(rolesToRemove).catch(() => null);
    await message.member.roles.add(targetItem.roleId, 'Đổi Role Icon thành công').catch((err) => {
      logger.error('[RoleIconShop] Không thể gán role icon cho member:', err);
    });

    ownership.owned_icons.push(targetItem.id);
    ownership.active_icon = targetItem.id;
    await saveUserOwnership(guildId, userId, ownership, client);

    const totalSlotsEarned = Math.floor(totalDonated / 20000);
    const remainingSlots = isOwner ? 'Vô hạn (Chủ Server)' : Math.max(0, totalSlotsEarned - ownership.owned_icons.length);
    const excessMoney = isOwner ? 0 : totalDonated % 20000;

    let excessNote = '';
    if (!isOwner) {
      excessNote = `\n> ${ROLE_ICON_EMOJIS.bullet} **Số suất đổi còn lại:** Bạn còn nguyên **${remainingSlots} suất** nữa!`;
      if (excessMoney > 0) {
        excessNote += `\n> ${ROLE_ICON_EMOJIS.bullet} **Số tiền dư tích lũy lẻ:** **${formatMoney(excessMoney)}** (được bảo lưu cộng dồn cho lần sau).`;
      }
    } else {
      excessNote = `\n> ${ROLE_ICON_EMOJIS.crown} *(Đặc quyền Chủ Server: Miễn phí kiểm tra & test toàn bộ tính năng)*`;
    }

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `> ${ROLE_ICON_EMOJIS.success} Đổi Role Icon thành công cho **${message.member.displayName}**! ${targetItem.emoji}\n` +
        `> ${ROLE_ICON_EMOJIS.roleEmojiTag} **Vật phẩm:** **${targetItem.name} (#${targetItem.padId})**\n` +
        `> ${ROLE_ICON_EMOJIS.roleIdTag} **Role được cấp:** <@&${targetItem.roleId}>\n` +
        `> ${ROLE_ICON_EMOJIS.success} **Biểu tượng:** Đã kích hoạt icon ${targetItem.emoji} hiển thị cạnh tên bạn trong mọi khung chat!${excessNote}`
      )
    );

    return sendReplyAndRefresh(container);
  } catch (err) {
    logger.error('[RoleIconShop] Lỗi khi đổi role icon:', err);
    return true;
  }
}

/**
 * =========================================================
 * CẤP BÙ TỰ ĐỘNG ROLE ĐẶC QUYỀN (AUTO-BACKFILL)
 * =========================================================
 */
export async function backfillDonorRoles(guild, client) {
  const pool = getPool(client);
  if (!pool || !guild) return { synced: 0, total: 0 };

  try {
    const res = await pool.query(
      `SELECT DISTINCT donor_id FROM financial_transactions 
       WHERE guild_id = $1 AND scope = 'personal' AND donor_id IS NOT NULL`,
      [guild.id]
    );

    let synced = 0;
    for (const row of res.rows) {
      try {
        const member = await guild.members.fetch(row.donor_id).catch(() => null);
        if (member && !member.roles.cache.has(ROLE_ICON_DONOR_ROLE_ID)) {
          await member.roles.add(ROLE_ICON_DONOR_ROLE_ID, 'Cấp bù Role Đặc Quyền mở khóa Tiệm Role Icon').catch(() => null);
          synced++;
        }
      } catch {}
    }
    logger.info(`🔮 [RoleIconShop] Cấp bù Role Đặc Quyền: Đã cấp cho ${synced}/${res.rows.length} thành viên.`);
    return { synced, total: res.rows.length };
  } catch (err) {
    logger.warn('[RoleIconShop] Lỗi khi quét cấp bù role donor:', err);
    return { synced: 0, total: 0 };
  }
}

