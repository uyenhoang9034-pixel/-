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
  infoEmbed,
} from '../../utils/embeds.js';

import {
  InteractionHelper,
} from '../../utils/interactionHelper.js';

import {
  WORD_CHAIN_CHANNELS,
  WORD_CHAIN_MODES,
  getWordChainGame,
  getWordChainConfig,
  activateWordChain,
  disableWordChain,
  isValidWord,
  getLastSyllable,
} from '../../services/wordChainService.js';

import {
  logger,
} from '../../utils/logger.js';

import {
  replyUserError,
  ErrorTypes,
} from '../../utils/errorHandler.js';

import {
  hasRoleTier,
  buildRoleDeniedMessage,
} from '../../config/commands/roleAccess.js';

/**
 * =========================================================
 * IMAGE CONFIG
 * =========================================================
 */

const WORD_CHAIN_SETUP_IMAGE_PATH =
  path.resolve(process.cwd(), 'assets/noitu/noitu.webp');

const WORD_CHAIN_SETUP_IMAGE_URL =
  'https://files.catbox.moe/5zr3vm.webp';

/**
 * =========================================================
 * UI
 * =========================================================
 */

const WORD_CHAIN_SETUP_COLOR =
  '#6EA8FE';

const WORD_CHAIN_EMOJIS = {
  mode:
    '<a:knifeg1:1546058092016312381>',

  info:
    '<a:trangtrig19:1546068350030053406>',

  newRound:
    '<a:animeg3:1546040346717331477>',
};

/**
 * =========================================================
 * COMMAND
 * =========================================================
 */

export default {
  data:
    new SlashCommandBuilder()
      .setName(
        'noitu-admin',
      )
      .setDescription(
        'Quản lý thiết lập minigame Nối từ Tiếng Việt (Dành cho Quản Trị)',
      )
      .setDefaultMemberPermissions(
        0n,
      )
      .setDMPermission(
        false,
      )

      /**
       * =====================================================
       * SETUP
       * =====================================================
       */

      .addSubcommand(
        subcommand =>
          subcommand
            .setName(
              'setup',
            )
            .setDescription(
              'Thiết lập Nối Từ cho cả hai kênh cố định',
            )
            .addStringOption(
              option =>
                option
                  .setName(
                    'start_word',
                  )
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
        subcommand =>
          subcommand
            .setName(
              'mode',
            )
            .setDescription(
              'Khởi động lại một chế độ tại kênh cố định',
            )
            .addStringOption(
              option =>
                option
                  .setName(
                    'mode',
                  )
                  .setDescription(
                    'Chọn chế độ',
                  )
                  .setRequired(
                    true,
                  )
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
        subcommand =>
          subcommand
            .setName(
              'disable',
            )
            .setDescription(
              'Tắt cả hai chế độ Nối Từ',
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

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags:
              MessageFlags.Ephemeral,
          },
        );

      if (
        !deferSuccess
      ) {
        logger.warn(
          'Noitu-admin command defer failed',
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
       * ADMIN ONLY (MID_ADMIN+)
       * =====================================================
       */

      if (
        !hasRoleTier(
          interaction.member,
          'MID_ADMIN',
          interaction.guild,
          interaction.user,
        )
      ) {
        return await replyUserError(
          interaction,
          {
            type:
              ErrorTypes.PERMISSION,

            message:
              buildRoleDeniedMessage(
                'noitu-admin',
              ),
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
        const startWordInput =
          interaction.options
            .getString(
              'start_word',
            );

        /**
         * JSON trước.
         * Không có -> online.
         */

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
                `Từ khởi đầu \`${startWordInput}\` không hợp lệ (phải gồm đúng 2 tiếng có nghĩa trong từ điển tiếng Việt).`,
            },
          );
        }

        /**
         * ===================================================
         * FETCH FIXED CHANNELS
         * ===================================================
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

        if (
          !pvpChannel
        ) {
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

        if (
          !botChannel
        ) {
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
         * ===================================================
         * ACTIVATE PVP
         * ===================================================
         */

        await activateWordChain(
          interaction.client,
          guildId,
          WORD_CHAIN_CHANNELS.pvp,
          'pvp',
          startWordInput,
        );

        /**
         * ===================================================
         * ACTIVATE PVE
         * ===================================================
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
         * ===================================================
         * GET GAMES
         * ===================================================
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

        const pvpAttachment = fs.existsSync(WORD_CHAIN_SETUP_IMAGE_PATH)
          ? new AttachmentBuilder(WORD_CHAIN_SETUP_IMAGE_PATH, { name: 'noitu.webp' })
          : null;

        pvpEmbed.setImage(
          pvpAttachment ? 'attachment://noitu.webp' : WORD_CHAIN_SETUP_IMAGE_URL,
        );

        await pvpChannel
          .send({
            embeds: [
              pvpEmbed,
            ],
            files: pvpAttachment ? [pvpAttachment] : [],
          })
          .catch(
            error => {
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

        const botAttachment = fs.existsSync(WORD_CHAIN_SETUP_IMAGE_PATH)
          ? new AttachmentBuilder(WORD_CHAIN_SETUP_IMAGE_PATH, { name: 'noitu.webp' })
          : null;

        botEmbed.setImage(
          botAttachment ? 'attachment://noitu.webp' : WORD_CHAIN_SETUP_IMAGE_URL,
        );

        await botChannel
          .send({
            embeds: [
              botEmbed,
            ],
            files: botAttachment ? [botAttachment] : [],
          })
          .catch(
            error => {
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
                  'Mỗi chế độ hiện có một ván chơi riêng.',
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

        const channelId =
          WORD_CHAIN_CHANNELS[
            newMode
          ];

        if (
          !channelId
        ) {
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

        if (
          !channel
        ) {
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
    } catch (
      error
    ) {
      logger.error(
        'Error executing noitu-admin command:',
        error,
      );

      return await replyUserError(
        interaction,
        {
          type:
            ErrorTypes.UNKNOWN,

          message:
            'Đã có lỗi xảy ra khi xử lý lệnh quản trị nối từ.',
        },
      );
    }
  },
};
