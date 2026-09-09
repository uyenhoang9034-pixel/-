import {
  MessageFlags,
} from 'discord.js';

import {
  CULTIVATION_CONFIG,
} from '../../config/cultivationGame.js';

import {
  breakthrough,
  cultivate,
  getCultivationLeaderboard,
  getCultivationProfile,
} from '../../services/cultivationService.js';

import {
  buildBackRow,
  buildBreakthroughEmbed,
  buildCultivateEmbed,
  buildDashboardEmbed,
  buildDashboardRows,
  buildLeaderboardEmbed,
  buildProfileEmbed,
} from '../../services/cultivationUI.js';

/**
 * =========================================================
 * PLAYER LOCK
 * =========================================================
 */

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

/**
 * =========================================================
 * CHANNEL CHECK
 * =========================================================
 */

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

/**
 * =========================================================
 * BUTTON HANDLER
 * =========================================================
 */

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
    ] = args;

    if (
      !ownerId ||
      !action
    ) {
      return;
    }

    /**
     * Không cho người khác điều khiển dashboard.
     */

    if (
      await rejectWrongPlayer(
        interaction,
        ownerId,
      )
    ) {
      return;
    }

    /**
     * Kiểm tra đúng channel.
     */

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
     * =====================================================
     * DASHBOARD
     * =====================================================
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
     * =====================================================
     * TU LUYỆN
     * =====================================================
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
     * =====================================================
     * ĐỘT PHÁ
     * =====================================================
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
     * =====================================================
     * HỒ SƠ
     * =====================================================
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
     * =====================================================
     * TIÊN BẢNG
     * =====================================================
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
  },
};
