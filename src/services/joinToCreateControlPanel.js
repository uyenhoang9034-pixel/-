import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

import {
  getJoinToCreateConfig,
  saveJoinToCreateConfig,
} from '../utils/database.js';

import {
  logger,
} from '../utils/logger.js';

/**
 * =========================================================
 * USAGI PANEL IMAGE
 * =========================================================
 *
 * DÁN LINK ẢNH TRỰC TIẾP CỦA BẠN VÀO ĐÂY.
 *
 * Nên dùng:
 *
 * https://cdn.discordapp.com/attachments/...
 *
 * hoặc:
 *
 * https://media.discordapp.net/attachments/...
 *
 * Link phải mở trực tiếp ra ảnh.
 */

export const USAGI_PANEL_IMAGE_URL =
  'https://i.pinimg.com/736x/52/b6/04/52b604fb4972b0894d68284d9fcd30d0.jpg';

/**
 * =========================================================
 * BUILD USAGI CONTROL PANEL
 * =========================================================
 */

export function buildJoinToCreateControlPanel() {
  const embed =
    new EmbedBuilder()
      .setColor(
        0xffb7cf,
      )
      .setTitle(
        '🐰・Usagi Voice Room',
      )
      .setDescription(
        [
          'Chào mừng đến với bảng điều khiển phòng Voice riêng! 🌸',
          '',
          'Bạn có thể quản lý **phòng Voice do chính mình tạo** bằng các nút bên dưới.',
          '',
          '> Chỉ **chủ phòng** mới có thể thay đổi cài đặt của phòng.',
          '> Bạn cần tạo phòng trước khi sử dụng bảng điều khiển.',
        ].join('\n'),
      )
      .setFooter({
        text:
          'Usagi TempVoice • Phòng sẽ tự xóa khi không còn người',
      });

  /**
   * =========================================================
   * PANEL IMAGE
   * =========================================================
   *
   * Chỉ set ảnh nếu URL đã được cấu hình.
   *
   * Điều này giúp bot không crash nếu bạn
   * quên thay placeholder.
   */

  if (
    USAGI_PANEL_IMAGE_URL &&
    USAGI_PANEL_IMAGE_URL !==
      'DAN_LINK_ANH_USAGI_CUA_BAN_VAO_DAY'
  ) {
    embed.setImage(
      USAGI_PANEL_IMAGE_URL,
    );
  }

  /**
   * =========================================================
   * ROW 1
   * =========================================================
   */

  const row1 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'jtc_room:name',
          )
          .setLabel(
            'Đổi tên',
          )
          .setEmoji(
            '✏️',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:limit',
          )
          .setLabel(
            'Giới hạn',
          )
          .setEmoji(
            '👥',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:lock',
          )
          .setLabel(
            'Khóa',
          )
          .setEmoji(
            '🔒',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:unlock',
          )
          .setLabel(
            'Mở khóa',
          )
          .setEmoji(
            '🔓',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:hide',
          )
          .setLabel(
            'Ẩn phòng',
          )
          .setEmoji(
            '🙈',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  /**
   * =========================================================
   * ROW 2
   * =========================================================
   */

  const row2 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'jtc_room:show',
          )
          .setLabel(
            'Hiện phòng',
          )
          .setEmoji(
            '👁️',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:allow',
          )
          .setLabel(
            'Cho phép',
          )
          .setEmoji(
            '💌',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:block',
          )
          .setLabel(
            'Chặn',
          )
          .setEmoji(
            '🚫',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:kick',
          )
          .setLabel(
            'Kick',
          )
          .setEmoji(
            '👢',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:transfer',
          )
          .setLabel(
            'Chuyển chủ',
          )
          .setEmoji(
            '👑',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  /**
   * =========================================================
   * ROW 3
   * =========================================================
   */

  const row3 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'jtc_room:region',
          )
          .setLabel(
            'Region',
          )
          .setEmoji(
            '🌏',
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:delete',
          )
          .setLabel(
            'Xóa phòng',
          )
          .setEmoji(
            '🗑️',
          )
          .setStyle(
            ButtonStyle.Danger,
          ),
      );

  return {
    embeds: [
      embed,
    ],

    components: [
      row1,
      row2,
      row3,
    ],
  };
}

/**
 * =========================================================
 * CREATE / RECREATE CONTROL PANEL
 * =========================================================
 */

export async function createJoinToCreateControlPanel(
  client,
  guild,
  channel,
) {
  const config =
    await getJoinToCreateConfig(
      client,
      guild.id,
    );

  /**
   * =========================================================
   * DELETE OLD PANEL
   * =========================================================
   *
   * Nếu panel cũ vẫn còn tồn tại,
   * xóa message cũ trước khi tạo message mới.
   *
   * Điều này tránh spam nhiều panel.
   */

  if (
    config.controlChannelId &&
    config.controlMessageId
  ) {
    const oldChannel =
      await guild.channels
        .fetch(
          config.controlChannelId,
        )
        .catch(
          () => null,
        );

    if (
      oldChannel?.isTextBased()
    ) {
      const oldMessage =
        await oldChannel.messages
          .fetch(
            config.controlMessageId,
          )
          .catch(
            () => null,
          );

      if (
        oldMessage
      ) {
        await oldMessage
          .delete()
          .catch(
            () => {},
          );
      }
    }
  }

  /**
   * =========================================================
   * SEND NEW PANEL
   * =========================================================
   */

  const payload =
    buildJoinToCreateControlPanel();

  const panelMessage =
    await channel.send(
      payload,
    );

  /**
   * =========================================================
   * SAVE PANEL LOCATION
   * =========================================================
   */

  config.controlChannelId =
    channel.id;

  config.controlMessageId =
    panelMessage.id;

  await saveJoinToCreateConfig(
    client,
    guild.id,
    config,
  );

  logger.info(
    `Created Join to Create control panel ${panelMessage.id} in guild ${guild.id}`,
  );

  return panelMessage;
}

export default {
  buildJoinToCreateControlPanel,
  createJoinToCreateControlPanel,
};
