import {
  SlashCommandBuilder,
  MessageFlags,
  AttachmentBuilder,
} from 'discord.js';

import fs from 'fs';
import path from 'path';

import {
  createEmbed,
  successEmbed,
} from '../../utils/embeds.js';

import {
  InteractionHelper,
} from '../../utils/interactionHelper.js';

import {
  WORD_CHAIN_CHANNELS,
  WORD_CHAIN_HINT_LIMIT,
  getWordChainModeForChannel,
  getWordChainGame,
  getWordChainConfig,
  getWordChainNow,
  isWordChainNightLock,
  buildWordChainNightLockPayloadV2,
  resetWordChainGame,
  buildWordChainLeaderboard,
  isValidWord,
  normalizeWord,
  getLastSyllable,
  getRandomStartWord,
  recordBreak,
  useWordChainHint,
} from '../../services/wordChainService.js';

import {
  logger,
} from '../../utils/logger.js';

import {
  replyUserError,
  ErrorTypes,
} from '../../utils/errorHandler.js';

/**
 * =========================================================
 * IMAGE CONFIG
 * =========================================================
 */

const WORD_CHAIN_LEADERBOARD_IMAGE_PATH =
  path.resolve(process.cwd(), 'assets/noitu/noituleaderboard.webp');

const WORD_CHAIN_LEADERBOARD_IMAGE_URL =
  'https://files.catbox.moe/2152b8.webp';

/**
 * =========================================================
 * UI
 * =========================================================
 */

const WORD_CHAIN_COLOR =
  '#F4A6C8';

const WORD_CHAIN_EMOJIS = {
  title:
    '⋆.ೃ࿔🌸*:･',

  mode:
    '<a:knifeg1:1546058092016312381>',

  info:
    '<a:trangtrig19:1546068350030053406>',

  correct:
    '✅',

  wrong:
    '❌',

  end:
    '<a:animeg2:1546040159886114846>',

  newRound:
    '<a:animeg3:1546040346717331477>',

  leaderboardStart:
    '<a:trangtrig2:1546040703375904801>',

  leaderboardEnd:
    '<a:trangtrig3:1546040818261954610>',

  words:
    '<a:trangtrig17:1546048098415939655>',

  hint:
    '<a:heartg1:1545307544808071258>',

  hintEnd:
    '<a:animeg1:1546040066676101224>',

  hintLimit:
    '<:jz6:1546154773693075566>',

  botSuccess:
    '<a:trangtrig29:1546385117478527016>',
};

function formatNumber(
  number,
) {
  return Number(
    number || 0,
  ).toLocaleString(
    'en-US',
  );
}

/**
 * =========================================================
 * COMMAND
 * =========================================================
 */

export default {
  data:
    new SlashCommandBuilder()
      .setName(
        'noitu',
      )
      .setDescription(
        'Quản lý minigame Nối từ Tiếng Việt',
      )
      .setDMPermission(
        false,
      )

      /**
       * =====================================================
       * STATUS
       * =====================================================
       */

      .addSubcommand(
        subcommand =>
          subcommand
            .setName(
              'status',
            )
            .setDescription(
              'Xem trạng thái Nối Từ',
            ),
      )

      /**
       * =====================================================
       * RESET
       * =====================================================
       */

      .addSubcommand(
        subcommand =>
          subcommand
            .setName(
              'reset',
            )
            .setDescription(
              'Làm mới ván Nối Từ hiện tại',
            )
            .addStringOption(
              option =>
                option
                  .setName(
                    'start_word',
                  )
                  .setDescription(
                    'Từ ghép 2 tiếng khởi đầu',
                  ),
            ),
      )

      /**
       * =====================================================
       * RESTART
       * =====================================================
       */

      .addSubcommand(
        subcommand =>
          subcommand
            .setName(
              'restart',
            )
            .setDescription(
              'Kết thúc chuỗi hiện tại và bắt đầu lượt mới',
            ),
      )

      /**
       * =====================================================
       * LEADERBOARD
       * =====================================================
       */

      .addSubcommand(
        subcommand =>
          subcommand
            .setName(
              'leaderboard',
            )
            .setDescription(
              'Xem bảng xếp hạng Nối Từ',
            ),
      )

      /**
       * =====================================================
       * GOIY
       * =====================================================
       */

      .addSubcommand(
        subcommand =>
          subcommand
            .setName(
              'goiy',
            )
            .setDescription(
              'Nhận một từ gợi ý để nối tiếp',
            ),
      ),

  category:
    'Fun',

  async execute(
    interaction,
  ) {
    try {
      const subcommand =
        interaction.options
          .getSubcommand();

      const nightStatus =
        isWordChainNightLock(
          getWordChainNow(
            interaction.client,
          ),
        );

      /**
       * Các lệnh xem/reset hiện công khai; trong khung giờ nghỉ 00:00 - 08:00, goiy cũng hiện công khai.
       */
      const isPublicView =
        subcommand ===
          'status' ||
        subcommand ===
          'leaderboard' ||
        subcommand ===
          'restart' ||
        subcommand ===
          'reset' ||
        (subcommand ===
          'goiy' &&
          nightStatus.locked);

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags:
              isPublicView
                ? undefined
                : MessageFlags.Ephemeral,
          },
        );

      if (
        !deferSuccess
      ) {
        logger.warn(
          'Noitu command defer failed',
          {
            userId:
              interaction.user.id,

            guildId:
              interaction.guildId,
          },
        );

        return;
      }

      const guildId =
        interaction.guildId;

      const config =
        await getWordChainConfig(
          interaction.client,
          guildId,
        );

      /**
       * =====================================================
       * STATUS
       * =====================================================
       */

      if (
        subcommand ===
        'status'
      ) {
        const pvpGame =
          getWordChainGame(
            config,
            'pvp',
          );

        const botGame =
          getWordChainGame(
            config,
            'bot',
          );

        const embed =
          createEmbed({
            title:
              '⋆.ೃ࿔🌸*:･𝓣𝓻𝓪̣𝓷𝓰 𝓣𝓱𝓪́𝓲 𝓝𝓸̂́𝓲 𝓣𝓾̛̀',

            fields: [
              {
                name:
                  `${WORD_CHAIN_EMOJIS.mode} PvP`,

                value:
                  pvpGame.enabled
                    ? [
                        `Kênh: <#${WORD_CHAIN_CHANNELS.pvp}>`,

                        `Từ hiện tại: **${pvpGame.currentWord || 'Chưa có'}**`,

                        `Chuỗi: **${pvpGame.currentStreak || 0}**`,
                      ].join(
                        '\n',
                      )
                    : 'Đang tắt',

                inline:
                  false,
              },

              {
                name:
                  `${WORD_CHAIN_EMOJIS.mode} PvE — Bot`,

                value:
                  botGame.enabled
                    ? [
                        `Kênh: <#${WORD_CHAIN_CHANNELS.bot}>`,

                        `Từ hiện tại: **${botGame.currentWord || 'Chưa có'}**`,

                        'Chuỗi cá nhân: **được lưu riêng theo người chơi**',
                      ].join(
                        '\n',
                      )
                    : 'Đang tắt',

                inline:
                  false,
              },
            ],

            color:
              WORD_CHAIN_COLOR,
          });

        if (nightStatus.locked) {
          embed.addFields({
            name: '🌙 Khung giờ nghỉ ban đêm (00:00 - 08:00)',
            value: `Hiện đang là **${nightStatus.currentTimeText}** (giờ Việt Nam) — nối từ tạm nghỉ để tiết kiệm RAM và sẽ mở lại lúc **${String(nightStatus.endHour).padStart(2, '0')}:00 sáng**.`,
            inline: false,
          });
        }

        return await InteractionHelper.safeEditReply(
          interaction,
          {
            embeds: [
              embed,
            ],
          },
        );
      }

      /**
       * =====================================================
       * RESET
       * =====================================================
       */

      if (
        subcommand ===
        'reset'
      ) {
        const mode =
          getWordChainModeForChannel(
            interaction.channelId,
          );

        if (
          !mode
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.USER_INPUT,

              message:
                `\`/noitu reset\` chỉ dùng được tại kênh PvP <#${WORD_CHAIN_CHANNELS.pvp}> hoặc kênh PvE <#${WORD_CHAIN_CHANNELS.bot}>.`,
            },
          );
        }

        const game =
          getWordChainGame(
            config,
            mode,
          );

        if (
          !game.enabled
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.UNKNOWN,

              message:
                `Chế độ ${mode === 'pvp' ? 'PvP' : 'PvE'} hiện chưa được bật. Hãy nhờ quản lý dùng \`/noitu-admin setup\`.`,
            },
          );
        }

        if (nightStatus.locked) {
          return await InteractionHelper.safeEditReply(
            interaction,
            buildWordChainNightLockPayloadV2({
              currentTimeText: nightStatus.currentTimeText,
              startHour: nightStatus.startHour,
              endHour: nightStatus.endHour,
              ephemeral: false,
            }),
          );
        }

        const startWordInput =
          interaction.options
            .getString(
              'start_word',
            );

        if (
          startWordInput &&
          !isValidWord(startWordInput)
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.VALIDATION,

              message:
                `Từ khởi đầu \`${startWordInput}\` không hợp lệ.`,
            },
          );
        }

        const nextStart =
          startWordInput
            ? normalizeWord(
                startWordInput,
              )
            : getRandomStartWord(
                [
                  game.currentWord,
                ].filter(
                  Boolean,
                ),
              );

        await resetWordChainGame(
          interaction.client,
          guildId,
          nextStart,
          mode,
        );

        await interaction.channel
          .send(
            [
              `${WORD_CHAIN_EMOJIS.newRound} Lượt **${mode === 'pvp' ? 'PvP' : 'PvE'}** đã được làm mới!`,

              `${WORD_CHAIN_EMOJIS.info} Từ bắt đầu: **${nextStart}**`,

              `${WORD_CHAIN_EMOJIS.info} Tiếng cần nối: **${getLastSyllable(nextStart)}**`,
            ].join(
              '\n',
            ),
          )
          .catch(
            () => {},
          );

        return await InteractionHelper.safeEditReply(
          interaction,
          {
            embeds: [
              successEmbed(
                'Đã Reset',
                `Lượt ${mode === 'pvp' ? 'PvP' : 'PvE'} đã được làm mới với từ **${nextStart}**.`,
              ),
            ],
          },
        );
      }

      /**
       * =====================================================
       * RESTART
       * =====================================================
       */

      if (
        subcommand ===
        'restart'
      ) {
        const mode =
          getWordChainModeForChannel(
            interaction.channelId,
          );

        if (
          !mode
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.USER_INPUT,

              message:
                `\`/noitu restart\` chỉ dùng được tại kênh PvP <#${WORD_CHAIN_CHANNELS.pvp}> hoặc PvE <#${WORD_CHAIN_CHANNELS.bot}>.`,
            },
          );
        }

        const game =
          getWordChainGame(
            config,
            mode,
          );

        if (
          !game.enabled
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.UNKNOWN,

              message:
                'Chế độ này hiện chưa được bật.',
            },
          );
        }

        if (nightStatus.locked) {
          return await InteractionHelper.safeEditReply(
            interaction,
            buildWordChainNightLockPayloadV2({
              currentTimeText: nightStatus.currentTimeText,
              startHour: nightStatus.startHour,
              endHour: nightStatus.endHour,
              ephemeral: false,
            }),
          );
        }

        const endedStreak =
          Number(
            game.currentStreak ||
            0,
          );

        const finalWord =
          game.currentWord ||
          'Chưa có';

        const nextStart =
          getRandomStartWord(
            [
              game.currentWord,
            ].filter(
              Boolean,
            ),
          );

        await recordBreak(
          interaction.client,
          guildId,
          nextStart,
          mode,
        );

        await interaction.channel
          .send(
            [
              `${WORD_CHAIN_EMOJIS.end} Chuỗi hiện tại kết thúc sau **${endedStreak}** với **${finalWord}**.`,

              `${WORD_CHAIN_EMOJIS.newRound} Lượt mới bắt đầu với **${nextStart}**!`,
            ].join(
              '\n',
            ),
          )
          .catch(
            () => {},
          );

        return await InteractionHelper.safeEditReply(
          interaction,
          {
            embeds: [
              successEmbed(
                'Đã Bắt Đầu Lượt Mới',
                `Lượt mới bắt đầu với **${nextStart}**.`,
              ),
            ],
          },
        );
      }

      /**
       * =====================================================
       * LEADERBOARD
       * =====================================================
       */

      if (
        subcommand ===
        'leaderboard'
      ) {
        const botPlayers =
          buildWordChainLeaderboard(
            config,
            'bot',
          );

        const pvpPlayers =
          buildWordChainLeaderboard(
            config,
            'pvp',
          );

        function formatLeaderboard(
          players,
          mode,
        ) {
          if (
            !players ||
            players.length ===
              0
          ) {
            return '*Chưa có người chơi nào.*';
          }

          const isPvE =
            mode ===
            'bot';

          return players
            .map(
              (
                entry,
                index,
              ) => {
                const medal =
                  index ===
                    0
                    ? '🥇'
                    : index ===
                        1
                      ? '🥈'
                      : index ===
                          2
                        ? '🥉'
                        : `**#${index + 1}**`;

                const mainScore =
                  isPvE
                    ? Number(
                        entry.bestStreak ??
                          entry.score ??
                          0,
                      )
                    : Number(
                        entry.correct ||
                          0,
                      );

                const mainLabel =
                  isPvE
                    ? 'chuỗi'
                    : 'từ';

                return [
                  `${medal} <@${entry.userId}>: **${formatNumber(mainScore)} ${mainLabel}** ${WORD_CHAIN_EMOJIS.words}`,

                  `　${WORD_CHAIN_EMOJIS.wrong} **${formatNumber(entry.wrong)}**  ·  ${WORD_CHAIN_EMOJIS.correct} **${formatNumber(entry.correct)}**`,
                ].join(
                  '\n',
                );
              },
            )
            .join(
              '\n',
            );
        }

        const embed =
          createEmbed({
            title:
              `${WORD_CHAIN_EMOJIS.leaderboardStart} ⋆.࿔🏆･ 𝓑𝓪̉𝓷𝓰 𝓧𝓮̂́𝓹 𝓗𝓪̣𝓷𝓰 𝓝𝓸̂́𝓲 𝓣𝓾̛̀ ${WORD_CHAIN_EMOJIS.leaderboardEnd}`,

            description:
              [
                `${WORD_CHAIN_EMOJIS.mode} **Đấu với Bot (PvE)**`,

                formatLeaderboard(
                  botPlayers,
                  'bot',
                ),

                '',

                `${WORD_CHAIN_EMOJIS.mode} **Đấu với người chơi (PvP)**`,

                formatLeaderboard(
                  pvpPlayers,
                  'pvp',
                ),
              ].join(
                '\n',
              ),

            color:
              WORD_CHAIN_COLOR,
          });

        const lbAttachment = fs.existsSync(WORD_CHAIN_LEADERBOARD_IMAGE_PATH)
          ? new AttachmentBuilder(WORD_CHAIN_LEADERBOARD_IMAGE_PATH, { name: 'noituleaderboard.webp' })
          : null;

        embed.setImage(
          lbAttachment ? 'attachment://noituleaderboard.webp' : WORD_CHAIN_LEADERBOARD_IMAGE_URL,
        );

        return await InteractionHelper.safeEditReply(
          interaction,
          {
            embeds: [
              embed,
            ],
            files: lbAttachment ? [lbAttachment] : [],
          },
        );
      }

      /**
       * =====================================================
       * GOIY
       * =====================================================
       */

      if (
        subcommand ===
        'goiy'
      ) {
        const mode =
          getWordChainModeForChannel(
            interaction.channelId,
          );

        if (
          !mode
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.USER_INPUT,

              message:
                `Bạn chỉ có thể dùng \`/noitu goiy\` tại kênh PvP <#${WORD_CHAIN_CHANNELS.pvp}> hoặc PvE <#${WORD_CHAIN_CHANNELS.bot}>.`,
            },
          );
        }

        const game =
          getWordChainGame(
            config,
            mode,
          );

        if (
          !game.enabled
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.UNKNOWN,

              message:
                'Chế độ Nối Từ tại kênh này hiện chưa được bật.',
            },
          );
        }

        if (nightStatus.locked) {
          return await InteractionHelper.safeEditReply(
            interaction,
            buildWordChainNightLockPayloadV2({
              currentTimeText: nightStatus.currentTimeText,
              startHour: nightStatus.startHour,
              endHour: nightStatus.endHour,
              ephemeral: false,
            }),
          );
        }

        const hintResult =
          await useWordChainHint(
            interaction.client,
            guildId,
            interaction.user.id,
            mode,
          );

        /**
         * Hết lượt hint.
         */

        if (
          hintResult.reason ===
          'limit'
        ) {
          return await InteractionHelper.safeEditReply(
            interaction,
            {
              content:
                `Bạn đã sử dụng hết **${WORD_CHAIN_HINT_LIMIT} lượt gợi ý** trong chuỗi này. ${WORD_CHAIN_EMOJIS.hintLimit}`,

              embeds:
                [],

              components:
                [],
            },
          );
        }

        if (
          hintResult.reason ===
          'no_word'
        ) {
          const latestConfig =
            await getWordChainConfig(
              interaction.client,
              guildId,
            );

          const latestGame =
            getWordChainGame(
              latestConfig,
              mode,
            );

          const endedStreak =
            Number(
              mode ===
                'bot'
                ? latestGame
                    .personalStreaks?.[
                      interaction.user.id
                    ] ||
                    0
                : latestGame
                    .currentStreak ||
                    0,
            );

          const finalWord =
            latestGame.currentWord ||
            'từ hiện tại';

          const nextStart =
            getRandomStartWord(
              [
                latestGame.currentWord,
              ].filter(
                Boolean,
              ),
            );

          await recordBreak(
            interaction.client,
            guildId,
            nextStart,
            mode,
          );

          return await InteractionHelper.safeEditReply(
            interaction,
            {
              content:
                [
                  `${WORD_CHAIN_EMOJIS.end} Nối từ đã kết thúc sau chuỗi **${endedStreak}** với **${finalWord}** là từ cuối cùng.`,

                  `${WORD_CHAIN_EMOJIS.newRound} Lượt nối từ mới đã bắt đầu với từ **${nextStart}**!`,
                ].join(
                  '\n',
                ),

              embeds:
                [],

              components:
                [],
            },
          );
        }

        /**
         * Hint success.
         */

        if (
          hintResult.ok &&
          hintResult.word
        ) {
          return await InteractionHelper.safeEditReply(
            interaction,
            {
              content:
                `${WORD_CHAIN_EMOJIS.hint} Gợi ý của bé Usagi là **${hintResult.word}**! Bạn còn **${hintResult.remaining} lượt gợi ý** trong chuỗi này. ${WORD_CHAIN_EMOJIS.hintEnd}`,

              embeds:
                [],

              components:
                [],
            },
          );
        }

        /**
         * Fallback cuối.
         */

        return await InteractionHelper.safeEditReply(
          interaction,
          {
            content:
              '🌸 Usagi hiện chưa thể đưa ra gợi ý. Bạn thử lại nhé!',

            embeds:
              [],

            components:
              [],
          },
        );
      }
    } catch (
      error
    ) {
      logger.error(
        'Error executing noitu command:',
        error,
      );

      return await replyUserError(
        interaction,
        {
          type:
            ErrorTypes.UNKNOWN,

          message:
            'Đã có lỗi xảy ra khi xử lý lệnh nối từ.',
        },
      );
    }
  },
};
