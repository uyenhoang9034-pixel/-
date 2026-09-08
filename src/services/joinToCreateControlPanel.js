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

import { logger } from '../utils/logger.js';


export const JTC_PANEL_IMAGE_PATH =
  path.join(
    __dirname,
    '../assets/usagi-voice-panel.png',
  );

/**
 * =========================================================
 * BUILD USAGI CONTROL PANEL
 * =========================================================
 */

export function buildJoinToCreateControlPanel() {
  const embed =
    new EmbedBuilder()
      .setColor(0xffb7cf)
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
      .setImage(
        'attachment://usagi-voice-panel.png',
      )
      .setFooter({
        text:
          'Usagi TempVoice • Phòng sẽ tự xóa khi không còn người',
      });

  /**
   * ROW 1
   */

  const row1 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'jtc_room:name',
          )
          .setLabel('Đổi tên')
          .setEmoji('✏️')
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:limit',
          )
          .setLabel('Giới hạn')
          .setEmoji('👥')
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:lock',
          )
          .setLabel('Khóa')
          .setEmoji('🔒')
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:unlock',
          )
          .setLabel('Mở khóa')
          .setEmoji('🔓')
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:hide',
          )
          .setLabel('Ẩn phòng')
          .setEmoji('🙈')
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  /**
   * ROW 2
   */

  const row2 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'jtc_room:show',
          )
          .setLabel('Hiện phòng')
          .setEmoji('👁️')
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:allow',
          )
          .setLabel('Cho phép')
          .setEmoji('💌')
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:block',
          )
          .setLabel('Chặn')
          .setEmoji('🚫')
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:kick',
          )
          .setLabel('Kick')
          .setEmoji('👢')
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:transfer',
          )
          .setLabel('Chuyển chủ')
          .setEmoji('👑')
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  /**
   * ROW 3
   */

  const row3 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'jtc_room:region',
          )
          .setLabel('Region')
          .setEmoji('🌏')
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:delete',
          )
          .setLabel('Xóa phòng')
          .setEmoji('🗑️')
          .setStyle(
            ButtonStyle.Danger,
          ),
      );

  const attachment =
    new AttachmentBuilder(
      JTC_PANEL_IMAGE_PATH,
      {
        name:
          'usagi-voice-panel.png',
      },
    );

  return {
    embeds: [embed],

    components: [
      row1,
      row2,
      row3,
    ],

    files: [
      attachment,
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
   * Nếu panel cũ còn tồn tại,
   * xóa trước để tránh duplicate.
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

      if (oldMessage) {
        await oldMessage
          .delete()
          .catch(
            () => {},
          );
      }
    }
  }

  const payload =
    buildJoinToCreateControlPanel();

  const panelMessage =
    await channel.send(
      payload,
    );

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
    `Created Join to Create control panel ${panelMessage.id} in ${guild.id}`,
  );

  return panelMessage;
}
