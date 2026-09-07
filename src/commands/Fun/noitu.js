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
  recordBreak,
  useWordChainHint,
  WORD_CHAIN_MODES,
} from '../../services/wordChainService.js';

import { logger } from '../../utils/logger.js';

import {
  replyUserError,
  ErrorTypes,
} from '../../utils/errorHandler.js';

/**
 * =========================================================
 * WORD CHAIN IMAGES
 * =========================================================
 *
 * Ảnh cố định dùng cho:
 *
 * - /noitu setup
 * - /noitu leaderboard
 *
 * Dùng setImage() nên ảnh sẽ hiển thị lớn,
 * KHÔNG phải thumbnail.
 */

const WORD_CHAIN_SETUP_IMAGE =
  'https://cdn.discordapp.com/attachments/1541300740947968020/1546424616745177188/142bbf46-3624-4f6b-bf7d-a11bd6bc46ac.png?ex=6a9fbba7&is=6a9e6a27&hm=9626f53c551aab68783820f5fbd0ab21b6d9c0d448a7441e5e86485ae0f660af&';

const WORD_CHAIN_LEADERBOARD_IMAGE =
  'https://cdn.discordapp.com/attachments/1541300740947968020/1546424616745177188/142bbf46-3624-4f6b-bf7d-a11bd6bc46ac.png?ex=6a9fbba7&is=6a9e6a27&hm=9626f53c551aab68783820f5fbd0ab21b6d9c0d448a7441e5e86485ae0f660af&';

/**
 * =========================================================
 * WORD CHAIN EMOJIS
 * =========================================================
 */

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

/**
 * =========================================================
 * FORMAT NUMBER
 * =========================================================
 */

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
  data: new SlashCommandBuilder()
    .setName('noitu')
    .setDescription(
      'Quản lý minigame Nối từ Tiếng Việt (Word Chain)',
    )
    .setDMPermission(false)

    /**
     * =====================================================
     * SETUP
     * =====================================================
     */

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

    /**
     * =====================================================
     * MODE
     * =====================================================
     */

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

    /**
     * =====================================================
     * DISABLE
     * =====================================================
     */

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

    /**
     * =====================================================
     * STATUS
     * =====================================================
     */

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

    /**
     * =====================================================
     * RESET
     * =====================================================
     */

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

    /**
     * =====================================================
     * RESTART
     * =====================================================
     */

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

    /**
     * =====================================================
     * LEADERBOARD
     * =====================================================
     */

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

      /**
       * Những command này hiển thị công khai.
       *
       * setup / mode / disable / reset / goiy
       * vẫn ephemeral.
       */

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

      /**
       * =====================================================
       * ADMIN SUBCOMMANDS
       * =====================================================
       */

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
       * =====================================================
       * SETUP
       * =====================================================
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

        /**
         * Kiểm tra từ khởi đầu.
         */

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

        /**
         * Kích hoạt game.
         */

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

        /**
         * ===================================================
         * GỬI PANEL SETUP VÀO CHANNEL GAME
         * ===================================================
         *
         * Ảnh cố định.
         *
         * Dùng setImage()
         * => ảnh lớn ở cuối embed.
         */

        const setupEmbed =
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
          });

        setupEmbed.setImage(
          WORD_CHAIN_SETUP_IMAGE,
        );

        await channel
          .send({
            embeds: [
              setupEmbed,
            ],
          })
          .catch(
            (error) => {
              logger.warn(
                'Failed to send word chain setup embed:',
                error,
              );
            },
          );

        /**
         * Phản hồi riêng cho admin.
         */

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
       * =====================================================
       * MODE
       * =====================================================
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
       * =====================================================
       * RESET
       * =====================================================
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
       * =====================================================
       * RESTART
       * =====================================================
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
       * =====================================================
       * DISABLE
       * =====================================================
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
       * =====================================================
       * STATUS
       * =====================================================
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

        /**
         * Ảnh leaderboard lớn.
         *
         * KHÔNG dùng setThumbnail().
         */

        embed.setImage(
          WORD_CHAIN_LEADERBOARD_IMAGE,
        );

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
       * GOIY
       * =====================================================
       *
       * /noitu goiy
       *
       * Mỗi người chỉ có 2 lượt gợi ý
       * trong MỘT chuỗi.
       *
       * Nếu không còn từ phù hợp:
       *
       * → kết thúc round
       * → reset streak
       * → reset hint
       * → reset usedWords
       * → tạo round mới
       */

      if (
        subcommand ===
        'goiy'
      ) {
        /**
         * ===================================================
         * GAME CHƯA BẬT
         * ===================================================
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
         * ===================================================
         * KIỂM TRA CHANNEL
         * ===================================================
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
         * ===================================================
         * GỌI HINT SERVICE
         * ===================================================
         */

        const hintResult =
          await useWordChainHint(
            interaction.client,
            guildId,
            interaction.user.id,
          );

        /**
         * ===================================================
         * HẾT LƯỢT GỢI Ý
         * ===================================================
         */

        if (
          hintResult.reason ===
          'limit'
        ) {
          return await InteractionHelper.safeEditReply(
            interaction,
            {
              content:
                `Xin lỗi bạn, bạn đã sử dụng hết lượt gợi ý của mình. Vui lòng tự suy nghĩ từ để nối tiếp! ${WORD_CHAIN_EMOJIS.hintLimit}`,

              embeds: [],
              components: [],
            },
          );
        }

        /**
         * ===================================================
         * KHÔNG CÒN TỪ ĐỂ GỢI Ý
         * ===================================================
         *
         * Đây là phần đã sửa.
         *
         * Trước đây:
         *
         * - chỉ báo "không còn từ"
         * - không reset game
         *
         * Bây giờ:
         *
         * - lấy streak hiện tại
         * - lấy từ cuối
         * - tạo từ mở đầu mới
         * - recordBreak()
         * - reset round
         * - bắt đầu round mới
         */

        if (
          hintResult.reason ===
          'no_word'
        ) {
          const endedStreak =
            Number(
              config.currentStreak || 0,
            );

          const finalWord =
            config.currentWord ||
            'từ hiện tại';

          const nextStart =
            getRandomStartWord();

          /**
           * Kết thúc round hiện tại
           * và tạo round mới.
           */

          await recordBreak(
            interaction.client,
            guildId,
            nextStart,
          );

          return await InteractionHelper.safeEditReply(
            interaction,
            {
              content:
                [
                  `${WORD_CHAIN_EMOJIS.end} Nối từ đã kết thúc sau chuỗi **${endedStreak}** với **${finalWord}** là từ cuối cùng.`,
                  `${WORD_CHAIN_EMOJIS.newRound} Lượt nối từ mới đã bắt đầu với từ **${nextStart}**!`,
                ].join('\n'),

              embeds: [],
              components: [],
            },
          );
        }

        /**
         * ===================================================
         * GỢI Ý THÀNH CÔNG
         * ===================================================
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
         * ===================================================
         * FALLBACK
         * ===================================================
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
   * resetWordChainGame() đã reset:
   *
   * - currentWord
   * - lastUserId
   * - usedWords
   * - currentStreak
   * - personalStreaks
   * - hintUses
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
