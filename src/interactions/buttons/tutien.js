import {
  MessageFlags,
} from 'discord.js';

import {
  CULTIVATION_CONFIG,
} from '../../config/cultivationGame.js';

import {
  adventure,
  breakthrough,
  cultivate,
  getCultivationLeaderboard,
  getCultivationProfile,
  useCultivationItem,
} from '../../services/cultivationService.js';

import {
  buildAdventureEmbed,
  buildBackRow,
  buildBreakthroughEmbed,
  buildCultivateEmbed,
  buildDashboardEmbed,
  buildDashboardRows,
  buildInventoryEmbed,
  buildInventoryRows,
  buildLeaderboardEmbed,
  buildProfileEmbed,
  buildUseItemResultEmbed,
  buildUseItemResultRows,
} from '../../services/cultivationUI.js';

async function rejectWrongPlayer(
  interaction,
  ownerId,
) {
  if (
    interaction.user.id ===
    ownerId
  ) {
    return false;
  }

  await interaction.reply({
    content:
      'Đây là Tiên Lộ của một đạo hữu khác. Dùng `/tutien` để mở hành trình của riêng bạn.',

    flags:
      MessageFlags.Ephemeral,
  });

  return true;
}

async function enforceChannel(
  interaction,
) {
  if (
    CULTIVATION_CONFIG
      .channelId &&
    interaction.channelId !==
      CULTIVATION_CONFIG
        .channelId
  ) {
    await interaction.reply({
      content:
        `Tiên Lộ chỉ mở tại <#${CULTIVATION_CONFIG.channelId}>.`,

      flags:
        MessageFlags.Ephemeral,
    });

    return false;
  }

  return true;
}

export default {
  name:
    'tutien_action',

  async execute(
    interaction,
    client,
    args = [],
  ) {
    const [
      ownerId,
      action,
      extra,
    ] = args;

    if (
      !ownerId ||
      !action
    ) {
      return;
    }

    if (
      await rejectWrongPlayer(
        interaction,
        ownerId,
      )
    ) {
      return;
    }

    if (
      !(await enforceChannel(
        interaction,
      ))
    ) {
      return;
    }

    const guildId =
      interaction.guildId;

    const userId =
      interaction.user.id;

    /**
     * DASHBOARD
     */

    if (
      action ===
      'dashboard'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildDashboardEmbed(
            interaction.user,
            profile,
          ),
        ],

        components:
          buildDashboardRows(
            ownerId,
          ),
      });
    }

    /**
     * TU LUYỆN
     */

    if (
      action ===
      'cultivate'
    ) {
      const result =
        await cultivate(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildCultivateEmbed(
            result,
          ),
        ],

        components: [
          buildBackRow(
            ownerId,
          ),
        ],
      });
    }

    /**
     * ĐỘT PHÁ
     */

    if (
      action ===
      'breakthrough'
    ) {
      const result =
        await breakthrough(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildBreakthroughEmbed(
            result,
          ),
        ],

        components: [
          buildBackRow(
            ownerId,
          ),
        ],
      });
    }

    /**
     * THÁM HIỂM
     */

    if (
      action ===
      'adventure'
    ) {
      const result =
        await adventure(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildAdventureEmbed(
            result,
          ),
        ],

        components: [
          buildBackRow(
            ownerId,
          ),
        ],
      });
    }

    /**
     * TÚI ĐỒ
     */

    if (
      action ===
      'inventory'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildInventoryEmbed(
            interaction.user,
            profile,
          ),
        ],

        components:
          buildInventoryRows(
            ownerId,
            profile,
          ),
      });
    }

    /**
     * SỬ DỤNG ITEM
     */

    if (
      action ===
      'use_item'
    ) {
      if (!extra) {
        return interaction.reply({
          content:
            'Không xác định được vật phẩm cần sử dụng.',

          flags:
            MessageFlags.Ephemeral,
        });
      }

      const result =
        await useCultivationItem(
          client,
          guildId,
          userId,
          extra,
        );

      return interaction.update({
        embeds: [
          buildUseItemResultEmbed(
            result,
          ),
        ],

        components:
          buildUseItemResultRows(
            ownerId,
          ),
      });
    }

    /**
     * HỒ SƠ
     */

    if (
      action ===
      'profile'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildProfileEmbed(
            interaction.user,
            profile,
          ),
        ],

        components: [
          buildBackRow(
            ownerId,
          ),
        ],
      });
    }

    /**
     * TIÊN BẢNG
     */

    if (
      action ===
      'leaderboard'
    ) {
      const entries =
        await getCultivationLeaderboard(
          client,
          guildId,
          10,
        );

      return interaction.update({
        embeds: [
          buildLeaderboardEmbed(
            entries,
            interaction.guild,
          ),
        ],

        components: [
          buildBackRow(
            ownerId,
          ),
        ],
      });
    }

    return interaction.reply({
      content:
        'Không tìm thấy hành động Tiên Lộ tương ứng.',

      flags:
        MessageFlags.Ephemeral,
    });
  },
};
