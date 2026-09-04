import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
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
  WORD_CHAIN_MODES,
} from '../../services/wordChainService.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('noitu')
    .setDescription('Quản lý minigame Nối từ Tiếng Việt (Word Chain)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Kích hoạt minigame nối từ trong một kênh chat')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Kênh văn bản dùng để chơi nối từ')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Chế độ chơi: PvP (Người vs Người) hoặc PvE (Đấu với Bot)')
            .setRequired(true)
            .addChoices(
              { name: 'Đấu với Bot (PvE)', value: 'bot' },
              { name: 'Người vs Người (PvP)', value: 'pvp' },
            ),
        )
        .addStringOption((option) =>
          option
            .setName('start_word')
            .setDescription('Từ ghép 2 tiếng khởi đầu ván chơi (để trống nếu muốn Bot chọn ngẫu nhiên)'),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('mode')
        .setDescription('Thay đổi chế độ chơi nối từ (PvP hoặc Đấu với Bot)')
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Chọn chế độ chơi mới')
            .setRequired(true)
            .addChoices(
              { name: 'Đấu với Bot (PvE)', value: 'bot' },
              { name: 'Người vs Người (PvP)', value: 'pvp' },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('disable').setDescription('Tắt minigame nối từ trên server'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Xem trạng thái hiện tại của minigame nối từ'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reset')
        .setDescription('Làm mới lại ván nối từ (bắt đầu ván mới)')
        .addStringOption((option) =>
          option
            .setName('start_word')
            .setDescription('Từ ghép 2 tiếng khởi đầu (để trống nếu muốn Bot chọn ngẫu nhiên)'),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('leaderboard').setDescription('Xem bảng xếp hạng người chơi nối từ xuất sắc nhất'),
    ),
  category: 'Fun',

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const isPublicView = subcommand === 'status' || subcommand === 'leaderboard';

      const deferSuccess = await InteractionHelper.safeDefer(interaction, {
        flags: isPublicView ? undefined : MessageFlags.Ephemeral,
      });

      if (!deferSuccess) {
        logger.warn('Noitu command defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      if (!isPublicView && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return await replyUserError(interaction, {
          type: ErrorTypes.PERMISSION,
          message: 'Bạn cần quyền **Manage Server (Quản lý Máy chủ)** để cấu hình lệnh này.',
        });
      }

      const guildId = interaction.guildId;
      const config = await getWordChainConfig(interaction.client, guildId);

      // --- SUBCOMMAND: SETUP ---
      if (subcommand === 'setup') {
        const channel = interaction.options.getChannel('channel');
        const mode = interaction.options.getString('mode');
        const startWordInput = interaction.options.getString('start_word');

        if (!channel || channel.type !== ChannelType.GuildText) {
          return await replyUserError(interaction, {
            type: ErrorTypes.VALIDATION,
            message: 'Vui lòng chọn một kênh chat văn bản hợp lệ.',
          });
        }

        if (startWordInput && !isValidWord(startWordInput)) {
          return await replyUserError(interaction, {
            type: ErrorTypes.VALIDATION,
            message: `Từ khởi đầu \`${startWordInput}\` không hợp lệ (phải gồm đúng 2 tiếng có nghĩa trong từ điển tiếng Việt).`,
          });
        }

        const updatedConfig = await activateWordChain(interaction.client, guildId, channel.id, mode, startWordInput);
        const modeInfo = WORD_CHAIN_MODES[mode];
        const nextSyllable = getLastSyllable(updatedConfig.currentWord);

        // Thông báo trong kênh nối từ
        await channel.send({
          embeds: [
            createEmbed({
              title: '🎮 Trò Chơi Nối Từ Tiếng Việt Đã Bắt Đầu!',
              description:
                `Chế độ: **${modeInfo.label}**\n` +
                `Luật chơi: Gõ từ ghép gồm đúng **2 tiếng** bắt đầu bằng tiếng cuối cùng của từ trước.\n\n` +
                `👉 Từ mở đầu: **${updatedConfig.currentWord}**\n` +
                `🎯 Tiếng cần nối tiếp: **${nextSyllable}**`,
              color: 'primary',
            }),
          ],
        }).catch(() => {});

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            successEmbed(
              'Thiết Lập Thành Công',
              `Đã kích hoạt minigame nối từ tại kênh ${channel} với chế độ **${modeInfo.label}**.\n` +
              `Từ khởi đầu hiện tại là: **${updatedConfig.currentWord}** (tiếng cần nối: \`${nextSyllable}\`).`,
            ),
          ],
        });
      }

      // --- SUBCOMMAND: MODE ---
      if (subcommand === 'mode') {
        const newMode = interaction.options.getString('mode');
        if (!config.enabled || !config.channelId) {
          return await replyUserError(interaction, {
            type: ErrorTypes.UNKNOWN,
            message: 'Server chưa thiết lập kênh nối từ. Hãy dùng `/noitu setup` trước.',
          });
        }

        config.mode = newMode;
        await saveWordChainConfig(interaction.client, guildId, config);

        const modeInfo = WORD_CHAIN_MODES[newMode];
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            successEmbed(
              'Đã Đổi Chế Độ Chơi',
              `Chế độ nối từ đã được chuyển sang: **${modeInfo.label}** (${modeInfo.description}).`,
            ),
          ],
        });
      }

      // --- SUBCOMMAND: RESET ---
      if (subcommand === 'reset') {
        if (!config.enabled || !config.channelId) {
          return await replyUserError(interaction, {
            type: ErrorTypes.UNKNOWN,
            message: 'Server chưa kích hoạt minigame nối từ. Hãy dùng `/noitu setup` trước.',
          });
        }

        const startWordInput = interaction.options.getString('start_word');
        if (startWordInput && !isValidWord(startWordInput)) {
          return await replyUserError(interaction, {
            type: ErrorTypes.VALIDATION,
            message: `Từ khởi đầu \`${startWordInput}\` không hợp lệ (phải gồm đúng 2 tiếng có nghĩa trong từ điển tiếng Việt).`,
          });
        }

        const updatedConfig = await resetWordChainGame(interaction.client, guildId, startWordInput);
        const nextSyllable = getLastSyllable(updatedConfig.currentWord);

        const channel = interaction.guild.channels.cache.get(updatedConfig.channelId);
        if (channel) {
          await channel.send({
            embeds: [
              infoEmbed(
                '🔄 Ván Nối Từ Mới Đã Bắt Đầu!',
                `Từ mở đầu: **${updatedConfig.currentWord}**\n` +
                `🎯 Tiếng cần nối: **${nextSyllable}**`,
              ),
            ],
          }).catch(() => {});
        }

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            successEmbed(
              'Đã Làm Mới Ván Chơi',
              `Ván nối từ đã được làm mới với từ khởi đầu: **${updatedConfig.currentWord}** (tiếng cần nối: \`${nextSyllable}\`).`,
            ),
          ],
        });
      }

      // --- SUBCOMMAND: DISABLE ---
      if (subcommand === 'disable') {
        if (!config.enabled) {
          return await InteractionHelper.safeEditReply(interaction, {
            embeds: [infoEmbed('Trạng Thái', 'Minigame nối từ hiện tại đã đang tắt.')],
          });
        }

        await disableWordChain(interaction.client, guildId);
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [successEmbed('Đã Tắt Minigame', 'Trò chơi nối từ đã bị vô hiệu hóa trên server này.')],
        });
      }

      // --- SUBCOMMAND: STATUS ---
      if (subcommand === 'status') {
        if (!config.enabled || !config.channelId) {
          return await InteractionHelper.safeEditReply(interaction, {
            embeds: [infoEmbed('Trạng Thái Minigame', 'Minigame nối từ chưa được kích hoạt trên server. Dùng `/noitu setup` để bắt đầu.')],
          });
        }

        const channel = interaction.guild.channels.cache.get(config.channelId);
        const modeInfo = WORD_CHAIN_MODES[config.mode] || WORD_CHAIN_MODES.bot;
        const nextSyllable = getLastSyllable(config.currentWord);

        const embed = createEmbed({
          title: '📖 Trạng Thái Minigame Nối Từ',
          fields: [
            { name: 'Kênh chơi', value: channel ? `${channel}` : `ID: ${config.channelId}`, inline: true },
            { name: 'Chế độ', value: `**${modeInfo.label}**`, inline: true },
            { name: 'Chuỗi hiện tại (Streak)', value: `🔥 **${config.currentStreak || 0}** từ`, inline: true },
            { name: 'Từ hiện tại', value: `**${config.currentWord || 'Chưa có'}**`, inline: true },
            { name: 'Tiếng cần nối tiếp', value: nextSyllable ? `👉 **${nextSyllable}**` : 'Bất kỳ', inline: true },
            { name: 'Kỷ lục cao nhất', value: `🏆 **${config.bestStreak || 0}** từ`, inline: true },
            { name: 'Số từ đã dùng ván này', value: `${config.usedWords?.length || 0} từ`, inline: true },
          ],
          color: 'primary',
        });

        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      // --- SUBCOMMAND: LEADERBOARD ---
      if (subcommand === 'leaderboard') {
        const topPlayers = buildWordChainLeaderboard(config);
        if (topPlayers.length === 0) {
          return await InteractionHelper.safeEditReply(interaction, {
            embeds: [infoEmbed('Bảng Xếp Hạng Nối Từ', 'Chưa có người chơi nào ghi điểm trong minigame nối từ.')],
          });
        }

        const lines = topPlayers.map((entry, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
          return `${medal} <@${entry.userId}>: **${entry.score}** từ nối đúng`;
        });

        const embed = createEmbed({
          title: '🏆 Bảng Xếp Hạng Nối Từ Tiếng Việt',
          description: lines.join('\n'),
          color: 'primary',
        });

        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }
    } catch (error) {
      logger.error('Error executing noitu command:', error);
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: 'Đã có lỗi xảy ra khi xử lý lệnh nối từ.',
      });
    }
  },
};
