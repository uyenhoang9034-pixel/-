import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} from 'discord.js';

import {
  createEmbed,
  successEmbed,
  infoEmbed,
} from '../../utils/embeds.js';

import {
  InteractionHelper,
} from '../../utils/interactionHelper.js';

import {
  getWordChainConfig,
  activateWordChain,
  disableWordChain,
  resetWordChainGame,
  buildWordChainLeaderboard,
  saveWordChainConfig,
  isValidWord,
  normalizeWord,
  getLastSyllable,
  getRandomStartWord,
  useWordChainHint,
  WORD_CHAIN_MODES,
} from '../../services/wordChainService.js';

import { logger } from '../../utils/logger.js';

import {
  replyUserError,
  ErrorTypes,
} from '../../utils/errorHandler.js';

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

export default {
  data: new SlashCommandBuilder()
    .setName('noitu')
    .setDescription(
      'Quản lý minigame Nối từ Tiếng Việt (Word Chain)',
    )
    .setDMPermission(false)

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName('setup')
          .setDescription(
            'Kích hoạt minigame nối từ trong một kênh chat',
          )

          .addChannelOption(
            (option) =>
              option
                .setName(
                  'channel',
                )
                .setDescription(
                  'Kênh văn bản dùng để chơi nối từ',
                )
                .setRequired(true)
                .addChannelTypes(
                  ChannelType.GuildText,
                ),
          )

          .addStringOption(
            (option) =>
              option
                .setName(
                  'mode',
                )
                .setDescription(
                  'Chế độ chơi',
                )
                .setRequired(true)
                .addChoices(
                  {
                    name:
                      'Đấu với Bot (PvE)',
                    value:
                      'bot',
                  },
                  {
                    name:
                      'Đấu với người chơi (PvP)',
                    value:
                      'pvp',
                  },
                ),
          )

          .addStringOption(
            (option) =>
              option
                .setName(
                  'start_word',
                )
                .setDescription(
                  'Từ ghép 2 tiếng khởi đầu',
                ),
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName('mode')
          .setDescription(
            'Thay đổi chế độ chơi nối từ',
          )

          .addStringOption(
            (option) =>
              option
                .setName(
                  'mode',
                )
                .setDescription(
                  'Chọn chế độ chơi mới',
                )
                .setRequired(true)
                .addChoices(
                  {
                    name:
                      'Đấu với Bot (PvE)',
                    value:
                      'bot',
                  },
                  {
                    name:
                      'Đấu với người chơi (PvP)',
                    value:
                      'pvp',
                  },
                ),
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            'disable',
          )
          .setDescription(
            'Tắt minigame nối từ',
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            'status',
          )
          .setDescription(
            'Xem trạng thái hiện tại của minigame',
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            'reset',
          )
          .setDescription(
            'Làm mới ván nối từ',
          )

          .addStringOption(
            (option) =>
              option
                .setName(
                  'start_word',
                )
                .setDescription(
                  'Từ ghép 2 tiếng khởi đầu',
                ),
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            'restart',
          )
          .setDescription(
            'Kết thúc chuỗi hiện tại và bắt đầu từ mới',
          ),
    )

    .addSubcommand(
      (subcommand) =>
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
     * HINT
     * =====================================================
     *
     * /noitu goiy
     *
     * - Tối đa 2 lần / một chuỗi / một người
     * - PvE và PvP đều dùng được
     * - Không cộng V
     * - Không cộng X
     * - Không tăng streak
     * - Không ảnh hưởng leaderboard
     */
    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            'goiy',
          )
          .setDescription(
            'Nhận một từ gợi ý để nối tiếp',
          ),
    ),

  category: 'Fun',

  async execute(
    interaction,
  ) {
    try {
      const subcommand =
        interaction.options
          .getSubcommand();

      const isPublicView =
        subcommand ===
          'status' ||
        subcommand ===
          'leaderboard' ||
        subcommand ===
          'restart';

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

      if (!deferSuccess) {
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

      const adminSubcommands =
        new Set([
          'setup',
          'mode',
          'disable',
          'reset',
        ]);

      if (
        adminSubcommands.has(
          subcommand,
        ) &&
        !interaction
          .memberPermissions
          ?.has(
            PermissionFlagsBits.ManageGuild,
          )
      ) {
        return await replyUserError(
          interaction,
          {
            type:
              ErrorTypes.PERMISSION,

            message:
              'Bạn cần quyền **Manage Server (Quản lý Máy chủ)** để sử dụng lệnh này.',
          },
        );
      }

      const guildId =
        interaction.guildId;

      const config =
        await getWordChainConfig(
          interaction.client,
          guildId,
        );

      /**
       * =================================================
       * SETUP
       * =================================================
       */

      if (
        subcommand ===
        'setup'
      ) {
        const channel =
          interaction.options
            .getChannel(
              'channel',
            );

        const mode =
          interaction.options
            .getString(
              'mode',
            );

        const startWordInput =
          interaction.options
            .getString(
              'start_word',
            );

        if (
          !channel ||
          channel.type !==
            ChannelType.GuildText
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.VALIDATION,

              message:
                'Vui lòng chọn một kênh chat văn bản hợp lệ.',
            },
          );
        }

        if (
          startWordInput &&
          !isValidWord(
            startWordInput,
          )
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.VALIDATION,

              message:
                `Từ khởi đầu \`${startWordInput}\` không hợp lệ (phải gồm đúng 2 tiếng có nghĩa trong từ điển tiếng Việt).`,
            },
          );
        }

        const updatedConfig =
          await activateWordChain(
            interaction.client,
            guildId,
            channel.id,
            mode,
            startWordInput,
          );

        const modeInfo =
          WORD_CHAIN_MODES[
            mode
          ];

        const nextSyllable =
          getLastSyllable(
            updatedConfig.currentWord,
          );

        await channel
          .send({
            embeds: [
              createEmbed({
                title:
                  '⋆.ೃ࿔🌸*:･「Nối Từ」— Game On!',

                description:
                  `${WORD_CHAIN_EMOJIS.mode} Chế độ: **${modeInfo.label}**\n` +
                  `<a:trangtrig18:1546068102817775626> Luật chơi: Gõ một từ ghép gồm đúng 2 tiếng, bắt đầu bằng tiếng cuối của từ trước. Nối tiếp thật nhanh và đừng để mất lượt nhé! <a:trangtrig6:1546043036390260756>\n\n` +
                  `<a:catg1:1541439053256462396> Từ mở đầu: **${updatedConfig.currentWord}**\n` +
                  `<a:catg1:1541439053256462396> Bắt đầu từ mới với: **${nextSyllable}**`,

                color:
                  'primary',
              }),
            ],
          })
          .catch(() => {});

        return await InteractionHelper.safeEditReply(
          interaction,
          {
            embeds: [
              successEmbed(
                'Thiết Lập Thành Công',
                `Đã kích hoạt minigame nối từ tại kênh ${channel} với chế độ **${modeInfo.label}**.\n` +
                  `Từ khởi đầu hiện tại là: **${updatedConfig.currentWord}** (tiếng cần nối: \`${nextSyllable}\`).`,
              ),
            ],
          },
        );
      }

      /**
       * =================================================
       * MODE
       * =================================================
       */

      if (
        subcommand ===
        'mode'
      ) {
        const newMode =
          interaction.options
            .getString(
              'mode',
            );

        if (
          !config.enabled ||
          !config.channelId
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.UNKNOWN,

              message:
                'Server chưa thiết lập kênh nối từ. Hãy dùng `/noitu setup` trước.',
            },
          );
        }

        config.mode =
          newMode;

        await saveWordChainConfig(
          interaction.client,
          guildId,
          config,
        );

        const modeInfo =
          WORD_CHAIN_MODES[
            newMode
          ];

        return await InteractionHelper.safeEditReply(
          interaction,
          {
            embeds: [
              successEmbed(
                'Đã Đổi Chế Độ Chơi',
                `Chế độ nối từ đã được chuyển sang: **${modeInfo.label}** (${modeInfo.description}).`,
              ),
            ],
          },
        );
      }

      /**
       * =================================================
       * RESET
       * =================================================
       */

      if (
        subcommand ===
        'reset'
      ) {
        if (
          !config.enabled ||
          !config.channelId
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.UNKNOWN,

              message:
                'Server chưa kích hoạt minigame nối từ. Hãy dùng `/noitu setup` trước.',
            },
          );
        }

        const startWordInput =
          interaction.options
            .getString(
              'start_word',
            );

        if (
          startWordInput &&
          !isValidWord(
            startWordInput,
          )
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

        return await restartGame(
          interaction,
          config,
          startWordInput,
        );
      }

      /**
       * =================================================
       * RESTART
       * =================================================
       */

      if (
        subcommand ===
        'restart'
      ) {
        if (
          !config.enabled ||
          !config.channelId
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.UNKNOWN,

              message:
                'Server chưa kích hoạt minigame nối từ.',
            },
          );
        }

        return await restartGame(
          interaction,
          config,
          null,
        );
      }

      /**
       * =================================================
       * DISABLE
       * =================================================
       */

      if (
        subcommand ===
        'disable'
      ) {
        if (
          !config.enabled
        ) {
          return await InteractionHelper.safeEditReply(
            interaction,
            {
              embeds: [
                infoEmbed(
                  'Trạng Thái',
                  'Minigame nối từ hiện tại đã đang tắt.',
                ),
              ],
            },
          );
        }

        await disableWordChain(
          interaction.client,
          guildId,
        );

        return await InteractionHelper.safeEditReply(
          interaction,
          {
            embeds: [
              successEmbed(
                'Đã Tắt Minigame',
                'Trò chơi nối từ đã bị vô hiệu hóa trên server này.',
              ),
            ],
          },
        );
      }

      /**
       * =================================================
       * STATUS
       * =================================================
       */

      if (
        subcommand ===
        'status'
      ) {
        if (
          !config.enabled ||
          !config.channelId
        ) {
          return await InteractionHelper.safeEditReply(
            interaction,
            {
              embeds: [
                infoEmbed(
                  'Trạng Thái Minigame',
                  'Minigame nối từ chưa được kích hoạt trên server. Dùng `/noitu setup` để bắt đầu.',
                ),
              ],
            },
          );
        }

        const modeInfo =
          WORD_CHAIN_MODES[
            config.mode
          ] ||
          WORD_CHAIN_MODES.bot;

        const nextSyllable =
          getLastSyllable(
            config.currentWord,
          );

        const embed =
          createEmbed({
            title:
              '⋆.ೃ࿔🌸*:･𝓣𝓻𝓪̣𝓷𝓰 𝓣𝓱𝓪́𝓲 𝓝𝓸̂́𝓲 𝓣𝓾̛̀',

            fields: [
              {
                name:
                  `${WORD_CHAIN_EMOJIS.mode} Chế độ`,

                value:
                  `**${modeInfo.label}**`,

                inline: true,
              },

              {
                name:
                  `${WORD_CHAIN_EMOJIS.info} Chuỗi hiện tại`,

                value:
                  `🔥 **${config.currentStreak || 0}** từ`,

                inline: true,
              },

              {
                name:
                  `${WORD_CHAIN_EMOJIS.info} Từ hiện tại`,

                value:
                  `**${config.currentWord || 'Chưa có'}**`,

                inline: true,
              },

              {
                name:
                  `${WORD_CHAIN_EMOJIS.info} Từ tiếp theo`,

                value:
                  nextSyllable
                    ? `👉 **${nextSyllable}**`
                    : 'Bất kỳ',

                inline: true,
              },

              {
                name:
                  `${WORD_CHAIN_EMOJIS.info} Kỷ lục cao nhất`,

                value:
                  `🏆 **${config.bestStreak || 0}** từ`,

                inline: true,
              },

              {
                name:
                  `${WORD_CHAIN_EMOJIS.info} Số từ đã dùng ván này`,

                value:
                  `${config.usedWords?.length || 0} từ`,

                inline: true,
              },
            ],

            color:
              'primary',
          });

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
       * =================================================
       * LEADERBOARD
       * =================================================
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
        ) {
          if (
            !players ||
            players.length === 0
          ) {
            return '*Chưa có người chơi nào.*';
          }

          return players
            .map(
              (
                entry,
                index,
              ) => {
                const medal =
                  index === 0
                    ? '🥇'
                    : index === 1
                      ? '🥈'
                      : index === 2
                        ? '🥉'
                        : `**#${index + 1}**`;

                return [
                  `${medal} <@${entry.userId}>: **${formatNumber(entry.correct)} từ** ${WORD_CHAIN_EMOJIS.words}`,
                  `　${WORD_CHAIN_EMOJIS.wrong} **${formatNumber(entry.wrong)}**  ·  ${WORD_CHAIN_EMOJIS.correct} **${formatNumber(entry.correct)}**`,
                ].join('\n');
              },
            )
            .join('\n');
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
                ),

                '',

                `${WORD_CHAIN_EMOJIS.mode} **Đấu với người chơi (PvP)**`,

                formatLeaderboard(
                  pvpPlayers,
                ),
              ].join('\n'),

            color:
              'primary',
          });

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
       * =================================================
       * GOIY
       * =================================================
       *
       * /noitu goiy
       *
       * Mỗi người chỉ có 2 lượt gợi ý
       * trong MỘT chuỗi.
       *
       * Ví dụ:
       *
       * Chuỗi 10  → đã dùng 2 lượt → không dùng tiếp
       * Chuỗi 50  → đã dùng 2 lượt → không dùng tiếp
       * Chuỗi 70  → đã dùng 2 lượt → không dùng tiếp
       *
       * Khi restart/reset:
       *
       * → hintUses được reset về 0.
       */

      if (
        subcommand ===
        'goiy'
      ) {
        /**
         * Game chưa bật.
         */

        if (
          !config.enabled ||
          !config.channelId
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.UNKNOWN,

              message:
                'Server chưa kích hoạt minigame nối từ. Hãy dùng `/noitu setup` trước.',
            },
          );
        }

        /**
         * Kiểm tra người dùng đang dùng
         * đúng kênh chơi nối từ.
         *
         * Không bắt buộc nếu command được
         * dùng ở channel khác trong server,
         * nhưng để tránh gợi ý nhầm game,
         * chỉ cho dùng tại channel game.
         */

        if (
          interaction.channelId !==
          config.channelId
        ) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.USER_INPUT,

              message:
                `Bạn chỉ có thể sử dụng \`/noitu goiy\` tại kênh <#${config.channelId}>.`,
            },
          );
        }

        /**
         * Gọi service đã có sẵn
         * trong wordChainService.js.
         *
         * Service tự xử lý:
         *
         * - mode bot / pvp
         * - userId
         * - giới hạn 2 lượt
         * - dictionary
         * - currentWord
         * - usedWords
         * - reset theo chuỗi
         */

        const hintResult =
          await useWordChainHint(
            interaction.client,
            guildId,
            interaction.user.id,
          );

        /**
         * =================================================
         * HẾT LƯỢT GỢI Ý
         * =================================================
         */

        if (
          hintResult.reason ===
          'limit'
        ) {
          return await InteractionHelper.safeEditReply(
            interaction,
            {
              content:
                `Xin lỗi bạn, bạn đã sử dụng hết lượt gợi ý của mình. Vui lòng dùng lệnh reset hoặc tự suy nghĩ từ để nối tiếp! ${WORD_CHAIN_EMOJIS.hintLimit}`,

              embeds: [],
              components: [],
            },
          );
        }

        /**
         * =================================================
         * KHÔNG CÓ TỪ ĐỂ GỢI Ý
         * =================================================
         *
         * Trường hợp này KHÔNG trừ lượt.
         */

        if (
          hintResult.reason ===
          'no_word'
        ) {
          return await InteractionHelper.safeEditReply(
            interaction,
            {
              content:
                `${WORD_CHAIN_EMOJIS.end} Hiện tại không còn từ phù hợp để gợi ý cho **${config.currentWord || 'từ hiện tại'}**.`,

              embeds: [],
              components: [],
            },
          );
        }

        /**
         * =================================================
         * GỢI Ý THÀNH CÔNG
         * =================================================
         */

        if (
          hintResult.ok &&
          hintResult.word
        ) {
          return await InteractionHelper.safeEditReply(
            interaction,
            {
              content:
                `${WORD_CHAIN_EMOJIS.hint} Cảm ơn bạn đã sử dụng gợi ý của bé bot cute phô mai que. Gợi ý của bạn là **${hintResult.word}**! Chúc bạn đạt được chuỗi cao nhé hehee! ${WORD_CHAIN_EMOJIS.hintEnd}`,

              embeds: [],

              components: [],
            },
          );
        }

        /**
         * =================================================
         * FALLBACK
         * =================================================
         */

        return await InteractionHelper.safeEditReply(
          interaction,
          {
            content:
              '🌸 Usagi hiện chưa thể đưa ra gợi ý. Bạn thử lại nhé!',

            embeds: [],
            components: [],
          },
        );
      }
    } catch (error) {
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

/**
 * =========================================================
 * RESTART HELPER
 * =========================================================
 */

async function restartGame(
  interaction,
  config,
  requestedStartWord = null,
) {
  const guildId =
    interaction.guildId;

  const endedStreak =
    Number(
      config.currentStreak || 0,
    );

  const finalWord =
    config.currentWord ||
    'Chưa có';

  const nextStart =
    requestedStartWord &&
    isValidWord(
      requestedStartWord,
    )
      ? normalizeWord(
          requestedStartWord,
        )
      : getRandomStartWord();

  /**
   * resetWordChainGame() hiện tại
   * đã reset:
   *
   * - currentWord
   * - lastUserId
   * - usedWords
   * - currentStreak
   * - personalStreaks
   * - hintUses
   *
   * nên không cần reset hintUses
   * thêm lần nữa ở đây.
   */

  await resetWordChainGame(
    interaction.client,
    guildId,
    nextStart,
  );

  const channel =
    interaction.guild.channels.cache.get(
      config.channelId,
    );

  if (channel) {
    const messages = [];

    if (
      endedStreak > 0
    ) {
      messages.push(
        `${WORD_CHAIN_EMOJIS.end} Quá siêu! Nối từ đã kết thúc sau chuỗi **${endedStreak}** với **${finalWord}** là từ cuối cùng.`,
      );
    }

    messages.push(
      `${WORD_CHAIN_EMOJIS.newRound} Lượt nối từ mới đã bắt đầu với từ **${nextStart}**!`,
    );

    await channel
      .send(
        messages.join('\n'),
      )
      .catch(() => {});
  }

  return await InteractionHelper.safeEditReply(
    interaction,
    {
      embeds: [
        successEmbed(
          'Đã Bắt Đầu Lượt Mới',
          `Lượt nối từ mới đã bắt đầu với từ **${nextStart}**.`,
        ),
      ],
    },
  );
}
