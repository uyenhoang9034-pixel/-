import {
  SlashCommandBuilder,
  PermissionFlagsBits,
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
  WORD_CHAIN_CHANNELS,
  WORD_CHAIN_HINT_LIMIT,
  getWordChainModeForChannel,
  getWordChainGame,
  getWordChainConfig,
  activateWordChain,
  disableWordChain,
  resetWordChainGame,
  buildWordChainLeaderboard,
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
 * FIXED IMAGES
 * =========================================================
 */

/**
 * ẢNH DÙNG CHO:
 *
 * /noitu setup
 *
 * Đây là ảnh lớn cố định của phần setup.
 */
const WORD_CHAIN_SETUP_IMAGE =
  'https://cdn.discordapp.com/attachments/1541300740947968020/1546424616745177188/142bbf46-3624-4f6b-bf7d-a11bd6bc46ac.png';

/**
 * ẢNH DÙNG CHO:
 *
 * /noitu leaderboard
 *
 * Đây là ảnh lớn riêng của Leaderboard.
 */
const WORD_CHAIN_LEADERBOARD_IMAGE =
  'https://cdn.discordapp.com/attachments/1541300740947968020/1546424571668729856/9c61060d-0389-4e7c-ae0c-ebe274c45c02.png';

/**
 * =========================================================
 * COLORS
 * =========================================================
 *
 * LEADERBOARD:
 * - Giữ màu hồng.
 *
 * SETUP:
 * - Dùng màu xanh dương.
 */

/**
 * Màu hồng cho Leaderboard.
 */
const WORD_CHAIN_COLOR =
  '#F4A6C8';

/**
 * Màu xanh dương cho /noitu setup.
 *
 * Chỉ áp dụng cho embed setup PvP + PvE.
 */
const WORD_CHAIN_SETUP_COLOR =
  '#6EA8FE';

/**
 * =========================================================
 * EMOJIS
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

function formatNumber(number) {
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
      'Quản lý minigame Nối từ Tiếng Việt',
    )
    .setDMPermission(false)

    /**
     * =====================================================
     * SETUP
     * =====================================================
     *
     * PvP:
     * 1545291672504508416
     *
     * PvE:
     * 1546428675367505920
     */

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName('setup')
          .setDescription(
            'Thiết lập Nối Từ cho cả hai kênh cố định',
          )
          .addStringOption(
            (option) =>
              option
                .setName('start_word')
                .setDescription(
                  'Từ ghép 2 tiếng khởi đầu cho cả hai chế độ',
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
            'Khởi động lại một chế độ tại kênh cố định',
          )
          .addStringOption(
            (option) =>
              option
                .setName('mode')
                .setDescription(
                  'Chọn chế độ',
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
          .setName('disable')
          .setDescription(
            'Tắt cả hai chế độ Nối Từ',
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
          .setName('status')
          .setDescription(
            'Xem trạng thái Nối Từ',
          ),
    )

    /**
     * =====================================================
     * RESET
     * =====================================================
     *
     * EVERYONE ĐƯỢC DÙNG.
     *
     * Chỉ reset game ở channel hiện tại.
     */

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName('reset')
          .setDescription(
            'Làm mới ván Nối Từ hiện tại',
          )
          .addStringOption(
            (option) =>
              option
                .setName('start_word')
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
          .setName('restart')
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
      (subcommand) =>
        subcommand
          .setName('leaderboard')
          .setDescription(
            'Xem bảng xếp hạng Nối Từ',
          ),
    )

    /**
     * =====================================================
     * GOIY
     * =====================================================
     *
     * Everyone được dùng.
     *
     * WORD_CHAIN_HINT_LIMIT = 3
     */

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName('goiy')
          .setDescription(
            'Nhận một từ gợi ý để nối tiếp',
          ),
    ),

  category: 'Fun',

  async execute(interaction) {
    try {
      const subcommand =
        interaction.options.getSubcommand();

      /**
       * Những lệnh này trả lời công khai.
       */

      const isPublicView =
        subcommand === 'status' ||
        subcommand === 'leaderboard' ||
        subcommand === 'restart' ||
        subcommand === 'reset';

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
       * ADMIN ONLY
       * =====================================================
       *
       * setup
       * mode
       * disable
       *
       * Các lệnh còn lại:
       *
       * reset
       * restart
       * status
       * leaderboard
       * goiy
       *
       * => everyone.
       */

      const adminSubcommands =
        new Set([
          'setup',
          'mode',
          'disable',
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
        subcommand === 'setup'
      ) {
        const startWordInput =
          interaction.options.getString(
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
                `Từ khởi đầu \`${startWordInput}\` không hợp lệ (phải gồm đúng 2 tiếng có nghĩa trong từ điển tiếng Việt).`,
            },
          );
        }

        /**
         * ---------------------------------------------------
         * FETCH FIXED CHANNELS
         * ---------------------------------------------------
         */

        const pvpChannel =
          await interaction.guild.channels
            .fetch(
              WORD_CHAIN_CHANNELS.pvp,
            )
            .catch(
              () => null,
            );

        const botChannel =
          await interaction.guild.channels
            .fetch(
              WORD_CHAIN_CHANNELS.bot,
            )
            .catch(
              () => null,
            );

        if (!pvpChannel) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.UNKNOWN,

              message:
                `Không tìm thấy kênh PvP <#${WORD_CHAIN_CHANNELS.pvp}> trong server.`,
            },
          );
        }

        if (!botChannel) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.UNKNOWN,

              message:
                `Không tìm thấy kênh PvE <#${WORD_CHAIN_CHANNELS.bot}> trong server.`,
            },
          );
        }

        /**
         * ---------------------------------------------------
         * ACTIVATE PVP
         * ---------------------------------------------------
         *
         * Nếu không nhập start_word:
         * service sẽ tự chọn từ ngẫu nhiên
         * trong dictionary.
         */

        await activateWordChain(
          interaction.client,
          guildId,
          WORD_CHAIN_CHANNELS.pvp,
          'pvp',
          startWordInput,
        );

        /**
         * ---------------------------------------------------
         * ACTIVATE PVE
         * ---------------------------------------------------
         *
         * Nếu không nhập start_word:
         * service tiếp tục chọn một từ ngẫu nhiên.
         */

        const updatedConfig =
          await activateWordChain(
            interaction.client,
            guildId,
            WORD_CHAIN_CHANNELS.bot,
            'bot',
            startWordInput,
          );

        /**
         * ---------------------------------------------------
         * GET GAMES
         * ---------------------------------------------------
         */

        const pvpGame =
          getWordChainGame(
            updatedConfig,
            'pvp',
          );

        const botGame =
          getWordChainGame(
            updatedConfig,
            'bot',
          );

        const pvpNext =
          getLastSyllable(
            pvpGame.currentWord,
          );

        const botNext =
          getLastSyllable(
            botGame.currentWord,
          );

        /**
         * ===================================================
         * PVP SETUP PANEL
         * ===================================================
         *
         * CHANGED:
         *
         * color = WORD_CHAIN_SETUP_COLOR
         *
         * => xanh dương.
         */

        const pvpEmbed =
          createEmbed({
            title:
              '⋆.ೃ࿔🌸*:･「Nối Từ」— PvP Game On!',

            description:
              `${WORD_CHAIN_EMOJIS.mode} Chế độ: **Đấu với người chơi (PvP)**\n` +
              `<a:trangtrig18:1546068102817775626> Luật chơi: Gõ một từ ghép gồm đúng 2 tiếng, bắt đầu bằng tiếng cuối của từ trước. Hai người chơi sẽ thay phiên nhau nối từ!\n\n` +
              `<a:catg1:1541439053256462396> Từ mở đầu: **${pvpGame.currentWord}**\n` +
              `<a:catg1:1541439053256462396> Bắt đầu từ mới với: **${pvpNext}**`,

            color:
              WORD_CHAIN_SETUP_COLOR,
          });

        /**
         * ẢNH SETUP CỐ ĐỊNH.
         */

        pvpEmbed.setImage(
          WORD_CHAIN_SETUP_IMAGE,
        );

        await pvpChannel
          .send({
            embeds: [
              pvpEmbed,
            ],
          })
          .catch(
            (error) => {
              logger.warn(
                'Failed to send PvP setup embed:',
                error,
              );
            },
          );

        /**
         * ===================================================
         * PVE SETUP PANEL
         * ===================================================
         */

        const botEmbed =
          createEmbed({
            title:
              '⋆.ೃ࿔🌸*:･「Nối Từ」— Bot Game On!',

            description:
              `${WORD_CHAIN_EMOJIS.mode} Chế độ: **Đấu với Bot (PvE)**\n` +
              `<a:trangtrig18:1546068102817775626> Luật chơi: Gõ một từ ghép gồm đúng 2 tiếng, bắt đầu bằng tiếng cuối của từ trước. Usagi sẽ tự động nối từ tiếp theo!\n\n` +
              `<a:catg1:1541439053256462396> Từ mở đầu: **${botGame.currentWord}**\n` +
              `<a:catg1:1541439053256462396> Bắt đầu từ mới với: **${botNext}**`,

            color:
              WORD_CHAIN_SETUP_COLOR,
          });

        /**
         * ẢNH SETUP CỐ ĐỊNH.
         */

        botEmbed.setImage(
          WORD_CHAIN_SETUP_IMAGE,
        );

        await botChannel
          .send({
            embeds: [
              botEmbed,
            ],
          })
          .catch(
            (error) => {
              logger.warn(
                'Failed to send PvE setup embed:',
                error,
              );
            },
          );

        return await InteractionHelper.safeEditReply(
          interaction,
          {
            embeds: [
              successEmbed(
                'Thiết Lập Thành Công',
                `Đã thiết lập Nối Từ cho cả hai kênh cố định.\n\n` +
                  `⚔️ PvP: <#${WORD_CHAIN_CHANNELS.pvp}>\n` +
                  `🤖 PvE: <#${WORD_CHAIN_CHANNELS.bot}>\n\n` +
                  `Mỗi chế độ hiện có một ván chơi riêng.`,
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
        subcommand === 'mode'
      ) {
        const newMode =
          interaction.options.getString(
            'mode',
          );

        const channelId =
          WORD_CHAIN_CHANNELS[
            newMode
          ];

        if (!channelId) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.VALIDATION,

              message:
                'Chế độ nối từ không hợp lệ.',
            },
          );
        }

        const channel =
          await interaction.guild.channels
            .fetch(
              channelId,
            )
            .catch(
              () => null,
            );

        if (!channel) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.UNKNOWN,

              message:
                `Không tìm thấy kênh cố định cho chế độ ${newMode}.`,
            },
          );
        }

        /**
         * Không truyền startWord.
         *
         * activateWordChain()
         * sẽ lấy từ ngẫu nhiên từ dictionary.
         */

        const updated =
          await activateWordChain(
            interaction.client,
            guildId,
            channelId,
            newMode,
            null,
          );

        const game =
          getWordChainGame(
            updated,
            newMode,
          );

        const modeInfo =
          WORD_CHAIN_MODES[
            newMode
          ];

        const nextSyllable =
          getLastSyllable(
            game.currentWord,
          );

        await channel
          .send(
            [
              `${WORD_CHAIN_EMOJIS.newRound} **${modeInfo.label}** đã được quản lý khởi động lại.`,
              `${WORD_CHAIN_EMOJIS.info} Từ mới: **${game.currentWord}**`,
              `${WORD_CHAIN_EMOJIS.info} Tiếng cần nối: **${nextSyllable}**`,
            ].join('\n'),
          )
          .catch(() => {});

        return await InteractionHelper.safeEditReply(
          interaction,
          {
            embeds: [
              successEmbed(
                'Đã Đổi / Khởi Động Chế Độ',
                `**${modeInfo.label}** hiện hoạt động tại <#${channelId}>.\n\n` +
                  `Từ khởi đầu: **${game.currentWord}**`,
              ),
            ],
          },
        );
      }

      /**
       * =====================================================
       * DISABLE
       * =====================================================
       */

      if (
        subcommand === 'disable'
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
                  'Cả hai chế độ Nối Từ hiện đã tắt.',
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
                'Đã tắt cả PvP và PvE Nối Từ.',
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
        subcommand === 'status'
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
                      ].join('\n')
                    : 'Đang tắt',

                inline: false,
              },

              {
                name:
                  `${WORD_CHAIN_EMOJIS.mode} PvE — Bot`,

                value:
                  botGame.enabled
                    ? [
                        `Kênh: <#${WORD_CHAIN_CHANNELS.bot}>`,
                        `Từ hiện tại: **${botGame.currentWord || 'Chưa có'}**`,
                        `Chuỗi cá nhân: **được lưu riêng theo người chơi**`,
                      ].join('\n')
                    : 'Đang tắt',

                inline: false,
              },
            ],

            /**
             * STATUS giữ nguyên màu hiện tại.
             *
             * Chỉ SETUP đổi sang xanh.
             */

            color:
              WORD_CHAIN_COLOR,
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
       * RESET
       * =====================================================
       *
       * EVERYONE.
       *
       * Chỉ reset mode của channel hiện tại.
       */

      if (
        subcommand === 'reset'
      ) {
        const mode =
          getWordChainModeForChannel(
            interaction.channelId,
          );

        if (!mode) {
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

        if (!game.enabled) {
          return await replyUserError(
            interaction,
            {
              type:
                ErrorTypes.UNKNOWN,

              message:
                `Chế độ ${mode === 'pvp' ? 'PvP' : 'PvE'} hiện chưa được bật. Hãy nhờ quản lý dùng \`/noitu setup\`.`,
            },
          );
        }

        const startWordInput =
          interaction.options.getString(
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

        /**
         * Nếu người dùng tự nhập từ:
         * dùng từ đó.
         *
         * Nếu không:
         * lấy từ random từ dictionary
         * và loại currentWord để tránh
         * lặp lại ngay round trước.
         */

        const nextStart =
          startWordInput
            ? normalizeWord(
                startWordInput,
              )
            : getRandomStartWord([
                game.currentWord,
              ].filter(Boolean));

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
            ].join('\n'),
          )
          .catch(() => {});

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
        subcommand === 'restart'
      ) {
        const mode =
          getWordChainModeForChannel(
            interaction.channelId,
          );

        if (!mode) {
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

        if (!game.enabled) {
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

        const endedStreak =
          Number(
            game.currentStreak || 0,
          );

        const finalWord =
          game.currentWord ||
          'Chưa có';

        /**
         * Random từ dictionary.
         *
         * Không lấy lại currentWord.
         */

        const nextStart =
          getRandomStartWord([
            game.currentWord,
          ].filter(Boolean));

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
            ].join('\n'),
          )
          .catch(() => {});

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
       *
       * PvP:
       * - Xếp theo tổng số từ đúng.
       *
       * PvE:
       * - Xếp theo bestStreak cao nhất.
       *
       * ẢNH:
       * - Dùng setImage()
       * - Không dùng setThumbnail()
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

        /**
         * ===================================================
         * FORMAT LEADERBOARD
         * ===================================================
         *
         * PvE và PvP hiển thị khác nhau:
         *
         * PvE:
         *    Chuỗi cao nhất
         *
         * PvP:
         *    Tổng số từ đúng
         *
         * Vẫn hiển thị:
         *    ❌ số sai
         *    ✅ số đúng
         */

        function formatLeaderboard(
          players,
          mode,
        ) {
          if (
            !players ||
            players.length === 0
          ) {
            return '*Chưa có người chơi nào.*';
          }

          const isPvE =
            mode === 'bot';

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

                /**
                 * PvE:
                 *
                 * score = bestStreak
                 *
                 * PvP:
                 *
                 * score = correct
                 */

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
                  'bot',
                ),

                '',

                `${WORD_CHAIN_EMOJIS.mode} **Đấu với người chơi (PvP)**`,
                formatLeaderboard(
                  pvpPlayers,
                  'pvp',
                ),
              ].join('\n'),

            /**
             * LEADERBOARD GIỮ NGUYÊN MÀU HỒNG.
             */

            color:
              WORD_CHAIN_COLOR,
          });

        /**
         * ===================================================
         * LEADERBOARD IMAGE
         * ===================================================
         *
         * Ảnh BỰ.
         *
         * KHÔNG dùng thumbnail.
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
       * EVERYONE.
       *
       * 3 lần / chuỗi.
       */

      if (
        subcommand === 'goiy'
      ) {
        const mode =
          getWordChainModeForChannel(
            interaction.channelId,
          );

        if (!mode) {
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

        const hintResult =
          await useWordChainHint(
            interaction.client,
            guildId,
            interaction.user.id,
            mode,
          );

        /**
         * ===================================================
         * HẾT 3 LƯỢT
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
                `Bạn đã sử dụng hết **${WORD_CHAIN_HINT_LIMIT} lượt gợi ý** trong chuỗi này. ${WORD_CHAIN_EMOJIS.hintLimit}`,

              embeds: [],

              components: [],
            },
          );
        }

        /**
         * ===================================================
         * KHÔNG CÒN TỪ
         * ===================================================
         *
         * Nếu không còn từ để gợi ý:
         *
         * 1. Không trừ lượt hint.
         * 2. Kết thúc chuỗi.
         * 3. Reset streak.
         * 4. Reset usedWords.
         * 5. Reset hint.
         * 6. Tạo round mới.
         */

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

          /**
           * PvE:
           * lấy streak của user hiện tại.
           *
           * PvP:
           * lấy streak chung.
           */

          const endedStreak =
            Number(
              mode === 'bot'
                ? latestGame
                    .personalStreaks?.[
                      interaction.user.id
                    ] || 0
                : latestGame
                    .currentStreak || 0,
            );

          const finalWord =
            latestGame.currentWord ||
            'từ hiện tại';

          /**
           * Random round mới.
           *
           * Không lấy lại từ hiện tại.
           */

          const nextStart =
            getRandomStartWord([
              latestGame.currentWord,
            ].filter(Boolean));

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
                ].join('\n'),

              embeds: [],

              components: [],
            },
          );
        }

        /**
         * ===================================================
         * HINT SUCCESS
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
                `${WORD_CHAIN_EMOJIS.hint} Gợi ý của bé Usagi là **${hintResult.word}**! Bạn còn **${hintResult.remaining} lượt gợi ý** trong chuỗi này. ${WORD_CHAIN_EMOJIS.hintEnd}`,

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
