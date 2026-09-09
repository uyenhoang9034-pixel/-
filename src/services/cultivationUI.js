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
 * HELPERS
 * =========================================================
 */

function applyStyle(
  embed,
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
    Math.ceil(
      ms / 1000,
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

  return (
    remaining > 0
      ? `${minutes}m ${remaining}s`
      : `${minutes}m`
  );
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

  const intro =
    isNew
      ? [
          '🌸 **THIÊN ĐẠO KHAI MỞ**',
          '',
          `<@${user.id}> đã chính thức bước vào Tiên Lộ.`,
          '',
          `Linh căn thức tỉnh: ${profile.spiritRoot.emoji} **${profile.spiritRoot.name}**`,
          `Phẩm chất: *${profile.spiritRoot.rarity}*`,
          '',
          '∘₊✧──────✧₊∘',
          '',
        ].join('\n')
      : '';

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        CULTIVATION_CONFIG
          .ui
          .title,
      )

      .setDescription(
        [
          intro,

          `👤 **Đạo hữu:** <@${user.id}>`,

          `境界 **${getRealmDisplay(
            profile,
          )}**`,

          `灵根 ${profile.spiritRoot.emoji} **${profile.spiritRoot.name}**`,

          '',

          '⋆.ೃ࿔🌸*:･ **Tu Vi**',

          `${progressBar(
            profile.cultivation,
            required,
          )}  **${number(
            profile.cultivation,
          )} / ${number(
            required,
          )}**`,

          '',

          `💎 **Linh Thạch:** ${number(
            profile.spiritStones,
          )}`,

          `❤️ **Thể Lực:** ${profile.stamina} / ${profile.maxStamina}`,

          '',

          '∘₊✧──────✧₊∘',

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
 * BUTTONS
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
          .setEmoji('🧘')
          .setStyle(
            ButtonStyle.Primary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:breakthrough`,
          )
          .setLabel(
            'Đột Phá',
          )
          .setEmoji('✨')
          .setStyle(
            ButtonStyle.Success,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:profile`,
          )
          .setLabel(
            'Hồ Sơ',
          )
          .setEmoji('👤')
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
          .setEmoji('🏆')
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
          .setEmoji('⚔️')
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
          .setEmoji('🎒')
          .setStyle(
            ButtonStyle.Secondary,
          )
          .setDisabled(
            true,
          ),
      ),
  ];
}

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
        .setEmoji('🌸')
        .setStyle(
          ButtonStyle.Secondary,
        ),
    );
}

/**
 * =========================================================
 * CULTIVATE
 * =========================================================
 */

export function buildCultivateEmbed(
  result,
) {
  if (
    !result.ok &&
    result.reason ===
      'cooldown'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '⏳ ✦ ĐẠO TÂM CHƯA ỔN ĐỊNH ✦',
        )

        .setDescription(
          [
            'Linh khí trong kinh mạch vẫn chưa hoàn toàn ổn định.',
            '',
            `Đạo hữu cần chờ **${duration(
              result.cooldownRemaining,
            )}** trước lần tu luyện tiếp theo.`,
          ].join('\n'),
        ),
    );
  }

  if (
    !result.ok &&
    result.reason ===
      'stamina'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '❤️ ✦ THỂ LỰC KHÔNG ĐỦ ✦',
        )

        .setDescription(
          [
            'Đạo hữu đã tiêu hao quá nhiều tinh lực.',
            '',
            'Hiện tại chưa đủ thể lực để tiếp tục vận chuyển công pháp.',
          ].join('\n'),
        ),
    );
  }

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

          '∘₊✧──────✧₊∘',

          '',

          `✨ **Tu Vi:** ${cultivationText}`,

          `💎 **Linh Thạch:** +${number(
            result.stoneDelta,
          )}`,

          `❤️ **Thể Lực:** -${result.staminaCost}`,

          '',

          `**${getRealmDisplay(
            result.profile,
          )}**`,

          `${progressBar(
            result.profile
              .cultivation,
            result.required,
          )}  **${number(
            result.profile
              .cultivation,
          )} / ${number(
            result.required,
          )}**`,
        ].join('\n'),
      ),
  );
}

/**
 * =========================================================
 * BREAKTHROUGH
 * =========================================================
 */

export function buildBreakthroughEmbed(
  result,
) {
  if (
    !result.ok &&
    result.reason ===
      'max_realm'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '🌌 ✦ ĐẠO TẬN CỬU TIÊU ✦',
        )

        .setDescription(
          'Đạo hữu đã đứng tại cảnh giới cao nhất hiện có của Tiên Lộ.',
        ),
    );
  }

  if (
    !result.ok &&
    result.reason ===
      'not_ready'
  ) {
    const missing =
      result.required -
      result.profile
        .cultivation;

    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '🔒 ✦ BÌNH CẢNH CHƯA MỞ ✦',
        )

        .setDescription(
          [
            `Cảnh giới hiện tại: **${getRealmDisplay(
              result.profile,
            )}**`,

            '',

            `Tu vi: **${number(
              result.profile
                .cultivation,
            )} / ${number(
              result.required,
            )}**`,

            `Còn thiếu: **${number(
              missing,
            )} Tu Vi**`,

            '',

            '*Tiếp tục tu luyện để chạm tới bình cảnh.*',
          ].join('\n'),
        ),
    );
  }

  const chance =
    Math.round(
      result.chance *
        100,
    );

  if (
    result.success
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '🌸 ✦ PHÁ CẢNH THÀNH CÔNG ✦',
        )

        .setDescription(
          [
            'Thiên địa linh khí chấn động, đạo cơ viên mãn.',

            '',

            `**${result.oldRealm}**`,

            '↓',

            `✨ **${result.newRealm}** ✨`,

            '',

            `Tỷ lệ thành công: **${chance}%**`,
          ].join('\n'),
        ),
    );
  }

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '⚡ ✦ ĐỘT PHÁ THẤT BẠI ✦',
      )

      .setDescription(
        [
          'Thiên uy giáng xuống, linh lực nhất thời tan loạn.',

          '',

          `Cảnh giới vẫn là **${result.oldRealm}**.`,

          `Tu vi hao tổn: **-${number(
            result.loss,
          )}**`,

          '',

          `Tỷ lệ thành công: **${chance}%**`,

          '',

          '*Chỉnh tức đạo tâm rồi hãy thử lại.*',
        ].join('\n'),
      ),
  );
}

/**
 * =========================================================
 * PROFILE
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
        '👤 ✦ HỒ SƠ TIÊN NHÂN ✦',
      )

      .setDescription(
        [
          `**Đạo hữu:** <@${user.id}>`,

          `**Cảnh giới:** ${getRealmDisplay(
            profile,
          )}`,

          `**Linh căn:** ${profile.spiritRoot.emoji} ${profile.spiritRoot.name}`,

          `**Phẩm chất:** ${profile.spiritRoot.rarity}`,

          '',

          `✨ **Tu Vi:** ${number(
            profile.cultivation,
          )} / ${number(
            required,
          )}`,

          `💎 **Linh Thạch:** ${number(
            profile.spiritStones,
          )}`,

          `❤️ **Thể Lực:** ${profile.stamina} / ${profile.maxStamina}`,

          `⚡ **Tỷ lệ đột phá:** ${chance}%`,

          '',

          '∘₊✧──────✧₊∘',

          '',

          `🧘 Tu luyện: **${profile.stats.cultivateCount}** lần`,

          `🌸 Kỳ ngộ: **${profile.stats.fortunes}** lần`,

          `✨ Đột phá thành công: **${profile.stats.breakthroughSuccess}**`,

          `💔 Đột phá thất bại: **${profile.stats.breakthroughFail}**`,
        ].join('\n'),
      ),
  );
}

/**
 * =========================================================
 * LEADERBOARD
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
          member?.displayName ||
          `<@${entry.userId}>`;

        return [
          `**#${index + 1} · ${name}**`,

          `└ ${entry.profile.spiritRoot.emoji} ${getRealmDisplay(
            entry.profile,
          )} · ✨ ${number(
            entry.profile
              .cultivation,
          )} Tu Vi`,
        ].join('\n');
      },
    );

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '🏆 ✦ TIÊN BẢNG ✦',
      )

      .setDescription(
        lines.length > 0
          ? lines.join(
              '\n\n',
            )
          : 'Tiên Bảng hiện chưa lưu danh bất kỳ đạo hữu nào.',
      ),
  );
}
