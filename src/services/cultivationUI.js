import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

import {
  CULTIVATION_CONFIG,
} from '../config/cultivationGame.js';

import {
  getBreakthroughChance,
  getCultivationRequired,
  getRealmDisplay,
} from './cultivationService.js';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const SEPARATOR =
  '꒷꒦︶꒷꒦︶ ๋ ࣭ ⭑꒷꒦';

const GAME_BUTTON_EMOJI = {
  id:
    CULTIVATION_CONFIG
      .ui
      .buttonEmojiId,
};

/**
 * =========================================================
 * BASE STYLE
 * =========================================================
 */

function applyStyle(
  embed,
  {
    image = true,
  } = {},
) {
  embed.setColor(
    CULTIVATION_CONFIG
      .ui
      .color,
  );

  embed.setFooter({
    text:
      CULTIVATION_CONFIG
        .ui
        .footer,
  });

  if (
    image &&
    CULTIVATION_CONFIG
      .ui
      .image
  ) {
    embed.setImage(
      CULTIVATION_CONFIG
        .ui
        .image,
    );
  }

  return embed;
}

/**
 * =========================================================
 * FORMAT HELPERS
 * =========================================================
 */

function number(
  value,
) {
  return new Intl.NumberFormat(
    'vi-VN',
  ).format(
    Math.max(
      0,
      Math.round(
        value || 0,
      ),
    ),
  );
}

function progressBar(
  current,
  max,
  size = 12,
) {
  if (
    !max ||
    max <= 0
  ) {
    return '░'.repeat(
      size,
    );
  }

  const ratio =
    Math.max(
      0,
      Math.min(
        1,
        current / max,
      ),
    );

  const filled =
    Math.round(
      ratio * size,
    );

  return (
    '█'.repeat(
      filled,
    ) +
    '░'.repeat(
      size - filled,
    )
  );
}

function duration(
  ms,
) {
  const seconds =
    Math.max(
      0,
      Math.ceil(
        ms / 1000,
      ),
    );

  const minutes =
    Math.floor(
      seconds / 60,
    );

  const remaining =
    seconds % 60;

  if (
    minutes <= 0
  ) {
    return `${remaining}s`;
  }

  if (
    remaining <= 0
  ) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remaining}s`;
}

/**
 * =========================================================
 * DASHBOARD
 * =========================================================
 */

export function buildDashboardEmbed(
  user,
  profile,
  {
    isNew = false,
  } = {},
) {
  const required =
    getCultivationRequired(
      profile,
    );

  const realm =
    getRealmDisplay(
      profile,
    );

  const intro =
    isNew
      ? [
          '<a:trangtrig2:1546040703375904801> **THIÊN ĐẠO KHAI MỞ** <a:trangtrig3:1546040818261954610>',
          '',
          `<@${user.id}> đã chính thức bước vào Tiên Lộ.`,
          '',
          `Linh căn thức tỉnh: **${profile.spiritRoot.name}**`,
          `Phẩm chất: **${profile.spiritRoot.rarity}**`,
          '',
          SEPARATOR,
          '',
        ].join('\n')
      : '';

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> 𝓣𝓲𝓮̂𝓷 𝓛𝓸̣̂ · 修仙之路 <a:trangtrig3:1546040818261954610>',
      )

      .setDescription(
        [
          intro,

          `<a:catg11:1546058047393239151> **Đạo Hữu**: <@${user.id}>`,

          `<a:trangtrig43:1547238351869059082> [**境界**] **${realm}**`,

          `<a:trangtrig44:1547238495494348891> [**灵根**] **${profile.spiritRoot.name}**`,

          '',

          '<:trangtri1:1546093044535660644> **Tu Vi**',

          `${progressBar(
            profile.cultivation,
            required,
          )} **${number(
            profile.cultivation,
          )} / ${number(
            required,
          )}**`,

          '',

          `<a:trangtrig46:1547240249761996812> **Linh Thạch**: ${number(
            profile.spiritStones,
          )}`,

          `<a:heartg4:1546068063500369940> **Thể Lực**: ${profile.stamina}/${profile.maxStamina}`,

          '',

          SEPARATOR,

          '',

          '*Một niệm nhập tiên đồ — từ phàm nhân, từng bước nghịch thiên mà hành.*',
        ]
          .filter(
            Boolean,
          )
          .join('\n'),
      ),
  );
}

/**
 * =========================================================
 * DASHBOARD BUTTONS
 * =========================================================
 */

export function buildDashboardRows(
  ownerId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:cultivate`,
          )
          .setLabel(
            'Tu Luyện',
          )
          .setEmoji(
            GAME_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:breakthrough`,
          )
          .setLabel(
            'Đột Phá',
          )
          .setEmoji(
            GAME_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:profile`,
          )
          .setLabel(
            'Hồ Sơ',
          )
          .setEmoji(
            GAME_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:leaderboard`,
          )
          .setLabel(
            'Tiên Bảng',
          )
          .setEmoji(
            GAME_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),

    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_locked:${ownerId}:adventure`,
          )
          .setLabel(
            'Thám Hiểm · V2',
          )
          .setEmoji(
            GAME_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          )
          .setDisabled(
            true,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_locked:${ownerId}:inventory`,
          )
          .setLabel(
            'Túi Đồ · V2',
          )
          .setEmoji(
            GAME_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          )
          .setDisabled(
            true,
          ),
      ),
  ];
}

/**
 * =========================================================
 * BACK BUTTON
 * =========================================================
 */

export function buildBackRow(
  ownerId,
) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `tutien_action:${ownerId}:dashboard`,
        )
        .setLabel(
          'Quay lại Tiên Lộ',
        )
        .setEmoji(
          GAME_BUTTON_EMOJI,
        )
        .setStyle(
          ButtonStyle.Secondary,
        ),
    );
}

/**
 * =========================================================
 * TU LUYỆN
 * =========================================================
 */

export function buildCultivateEmbed(
  result,
) {
  /**
   * COOLDOWN
   */

  if (
    !result.ok &&
    result.reason ===
      'cooldown'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> ĐẠO TÂM CHƯA ỔN ĐỊNH',
        )

        .setDescription(
          [
            '<a:bang2:1546891483250954290> Linh khí trong kinh mạch vẫn chưa hoàn toàn ổn định.',

            '',

            SEPARATOR,

            '',

            `<a:chiikawag13:1541429102668554250> Đạo hữu cần chờ **${duration(
              result.cooldownRemaining,
            )}** trước lần tu luyện tiếp theo.`,
          ].join('\n'),
        ),
    );
  }

  /**
   * KHÔNG ĐỦ THỂ LỰC
   */

  if (
    !result.ok &&
    result.reason ===
      'stamina'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> THỂ LỰC KHÔNG ĐỦ',
        )

        .setDescription(
          [
            '<a:bang2:1546891483250954290> Đạo hữu đã tiêu hao quá nhiều tinh lực.',

            '',

            SEPARATOR,

            '',

            '<a:chiikawag13:1541429102668554250> Hiện tại chưa đủ Thể Lực để tiếp tục tu luyện.',
          ].join('\n'),
        ),
    );
  }

  /**
   * TU VI +/- DYNAMIC
   */

  const cultivationText =
    result.cultivationDelta >=
    0
      ? `+${number(
          result.cultivationDelta,
        )}`
      : `-${number(
          Math.abs(
            result.cultivationDelta,
          ),
        )}`;

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        result.event.title,
      )

      .setDescription(
        [
          result.event.text,

          '',

          SEPARATOR,

          '',

          `**Tu Vi**: ${cultivationText}`,

          `**Linh Thạch**: +${number(
            result.stoneDelta,
          )}`,

          `**Thể Lực**: -${result.staminaCost}`,

          '',

          `<a:trangtrig43:1547238351869059082> [**境界**] **${getRealmDisplay(
            result.profile,
          )}**`,

          `${progressBar(
            result.profile
              .cultivation,
            result.required,
          )} ${number(
            result.profile
              .cultivation,
          )} / ${number(
            result.required,
          )}`,
        ].join('\n'),
      ),
  );
}

/**
 * =========================================================
 * ĐỘT PHÁ
 * =========================================================
 */

export function buildBreakthroughEmbed(
  result,
) {
  /**
   * MAX REALM
   */

  if (
    !result.ok &&
    result.reason ===
      'max_realm'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:trangtrig2:1546040703375904801> ĐẠO TẬN CỬU TIÊU <a:trangtrig3:1546040818261954610>',
        )

        .setDescription(
          'Đạo hữu đã đứng tại cảnh giới cao nhất hiện có của Tiên Lộ.',
        ),
    );
  }

  /**
   * BÌNH CẢNH CHƯA MỞ
   */

  if (
    !result.ok &&
    result.reason ===
      'not_ready'
  ) {
    const missing =
      Math.max(
        0,
        result.required -
          result.profile
            .cultivation,
      );

    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:trangtrig45:1547239010190237819> BÌNH CẢNH CHƯA MỞ <a:trangtrig45:1547239010190237819>',
        )

        .setDescription(
          [
            `<a:trangtrig6:1546043036390260756> Cảnh giới hiện tại: **${getRealmDisplay(
              result.profile,
            )}**`,

            `<a:trangtrig6:1546043036390260756> Tu Vi: **${number(
              result.profile
                .cultivation,
            )}**`,

            `<a:trangtrig6:1546043036390260756> Thiếu: **${number(
              missing,
            )}**`,

            '',

            '<:chiikawa4:1541429063392956516> *Tiếp tục tu luyện để chạm tới bình cảnh.*',
          ].join('\n'),
        ),
    );
  }

  const chance =
    Math.round(
      result.chance *
        100,
    );

  /**
   * ĐỘT PHÁ THÀNH CÔNG
   */

  if (
    result.success
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:trangtrig2:1546040703375904801> PHÁ CẢNH THÀNH CÔNG <a:trangtrig3:1546040818261954610>',
        )

        .setDescription(
          [
            'Thiên địa linh khí chấn động, đạo cơ viên mãn.',

            '',

            SEPARATOR,

            '',

            `**${result.oldRealm}**`,

            '↓',

            `**${result.newRealm}**`,

            '',

            `<a:trangtrig19:1546068350030053406> Tỷ Lệ Đột Phá: **${chance}%**`,
          ].join('\n'),
        ),
    );
  }

  /**
   * ĐỘT PHÁ THẤT BẠI
   */

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:angryg1:1541441195144773652> ĐỘT PHÁ THẤT BẠI',
      )

      .setDescription(
        [
          'Thiên uy giáng xuống, linh lực nhất thời tan loạn.',

          '',

          SEPARATOR,

          '',

          `<a:trangtrig43:1547238351869059082> Cảnh Giới: **${result.oldRealm}**`,

          `<:trangtri1:1546093044535660644> Tu Vi Hao Tổn: **-${number(
            result.loss,
          )}**`,

          `<a:trangtrig19:1546068350030053406> Tỷ Lệ Đột Phá: **${chance}%**`,

          '',

          '*Chỉnh tức đạo tâm rồi hãy thử lại.*',
        ].join('\n'),
      ),
  );
}

/**
 * =========================================================
 * HỒ SƠ
 * =========================================================
 */

export function buildProfileEmbed(
  user,
  profile,
) {
  const required =
    getCultivationRequired(
      profile,
    );

  const chance =
    Math.round(
      getBreakthroughChance(
        profile,
      ) * 100,
    );

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> HỒ SƠ TIÊN NHÂN <a:trangtrig3:1546040818261954610>',
      )

      .setDescription(
        [
          `<a:catg11:1546058047393239151> Đạo Hữu: <@${user.id}>`,

          `<a:trangtrig43:1547238351869059082> Cảnh Giới: **${getRealmDisplay(
            profile,
          )}**`,

          `<a:trangtrig44:1547238495494348891> Linh Căn: **${profile.spiritRoot.name}**`,

          `<a:trangtrig31:1546905996893626440> Phẩm Chất: **${profile.spiritRoot.rarity}**`,

          '',

          `<:trangtri1:1546093044535660644> Tu Vi: **${number(
            profile.cultivation,
          )} / ${number(
            required,
          )}**`,

          `<a:trangtrig46:1547240249761996812> Linh Thạch: **${number(
            profile.spiritStones,
          )}**`,

          `<a:heartg4:1546068063500369940> Thể Lực: **${profile.stamina} / ${profile.maxStamina}**`,

          `<a:trangtrig19:1546068350030053406> Tỷ Lệ Đột Phá: **${chance}%**`,

          '',

          SEPARATOR,

          '',

          `<a:trangtrig45:1547239010190237819> Tu Luyện: **${profile.stats.cultivateCount} lần**`,

          `<a:trangtrig45:1547239010190237819> Kỳ Ngộ: **${profile.stats.fortunes} lần**`,

          `<a:trangtrig45:1547239010190237819> Đột Phá Thành Công: **${profile.stats.breakthroughSuccess}**`,

          `<a:trangtrig45:1547239010190237819> Đột Phá Thất Bại: **${profile.stats.breakthroughFail}**`,
        ].join('\n'),
      ),
  );
}

/**
 * =========================================================
 * TIÊN BẢNG
 * =========================================================
 */

export function buildLeaderboardEmbed(
  entries,
  guild,
) {
  const lines =
    entries.map(
      (
        entry,
        index,
      ) => {
        const member =
          guild?.members
            ?.cache
            ?.get(
              entry.userId,
            );

        const name =
          member
            ?.displayName ||
          `<@${entry.userId}>`;

        return [
          `<a:trangtrig32:1546906170994856026>${index + 1} · **${name}**`,

          `<a:animeg3:1546040346717331477> **${getRealmDisplay(
            entry.profile,
          )}** <a:trangtrig29:1546385117478527016> **${number(
            entry.profile
              .cultivation,
          )}** Tu Vi`,
        ].join('\n');
      },
    );

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:animeg2:1546040159886114846> 𝓣𝓲𝓮̂𝓷 𝓑𝓪̉𝓷𝓰 <a:animeg2:1546040159886114846>',
      )

      .setDescription(
        lines.length > 0
          ? lines.join(
              '\n\n',
            )
          : '<a:animeg3:1546040346717331477> Tiên Bảng hiện chưa lưu danh bất kỳ đạo hữu nào.',
      ),
  );
}
