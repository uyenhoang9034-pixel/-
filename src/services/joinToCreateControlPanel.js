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
 */

export const USAGI_PANEL_IMAGE_URL =
  'https://cdn.discordapp.com/attachments/1541300740947968020/1546806015901696090/93a4c06a-09d0-4365-a4d5-cd62dfe787b9.png?ex=6aa11edc&is=6a9fcd5c&hm=04934cfe8e263cebfacd8701cd349366a865219508feaba0cf5e6861f9235006&';

/**
 * =========================================================
 * CUSTOM EMOJIS
 * =========================================================
 */

const JTC_EMOJIS = {
  /**
   * Đổi tên
   * Giới hạn
   */
  edit: {
    id: '1546047240265797682',
    name: 'trangtrig10',
    animated: true,
  },

  /**
   * Khóa
   * Mở khóa
   * Ẩn phòng
   */
  privacy: {
    id: '1546058092016312381',
    name: 'knifeg1',
    animated: true,
  },

  /**
   * Hiện phòng
   * Cho phép
   */
  allow: {
    id: '1546041656648929380',
    name: 'ilyg1',
    animated: true,
  },

  /**
   * Chặn
   * Kick
   */
  block: {
    id: '1546041273813827645',
    name: 'trangtrig4',
    animated: true,
  },

  /**
   * Chuyển chủ
   */
  transfer: {
    id: '1546047912969113622',
    name: 'trangtrig14',
    animated: true,
  },

  /**
   * Region
   */
  region: {
    id: '1546093044535660644',
    name: 'trangtri1',
    animated: false,
  },

  /**
   * Xóa phòng
   */
  delete: {
    id: '1546013742679064658',
    name: 'anime2',
    animated: false,
  },
};

/**
 * =========================================================
 * BUILD USAGI CONTROL PANEL
 * =========================================================
 */

export function buildJoinToCreateControlPanel() {
  /**
   * =======================================================
   * EMBED
   * =======================================================
   */

  const embed =
    new EmbedBuilder()
      .setColor(
        0xffb7cf,
      )
      .setTitle(
        '<a:trangtrig2:1546040703375904801> 𝓤𝓼𝓪𝓰𝓲 𝓥𝓸𝓲𝓬𝓮 𝓡𝓸𝓸𝓶 <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          'Cảm ơn và chào mừng bạn đã đến với bảng điều khiển voice room cá nhân! <a:heartg3:1546047728314884226>',
          '',
          '<a:trangtrig6:1546043036390260756> Bạn có thể quản lý **voice room** do chính mình tạo bằng các nút bên dưới. Chỉ có thể sử dụng bảng điều khiển sau khi tạo phòng!',
          '',
          '<a:trangtrig6:1546043036390260756> Chỉ **chủ phòng** mới có thể thay đổi cài đặt của phòng.',
        ].join('\n'),
      )
      .setImage(
        USAGI_PANEL_IMAGE_URL,
      )
      .setFooter({
        text:
          'Usagi TempVoice • Phòng sẽ tự xóa khi không còn người',
      });

  /**
   * =======================================================
   * ROW 1
   * =======================================================
   *
   * Đổi tên
   * Giới hạn
   * Khóa
   * Mở khóa
   * Ẩn phòng
   */

  const row1 =
    new ActionRowBuilder()
      .addComponents(
        /**
         * ĐỔI TÊN
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:name',
          )
          .setLabel(
            'Đổi tên',
          )
          .setEmoji(
            JTC_EMOJIS.edit,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /**
         * GIỚI HẠN
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:limit',
          )
          .setLabel(
            'Giới hạn',
          )
          .setEmoji(
            JTC_EMOJIS.edit,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /**
         * KHÓA
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:lock',
          )
          .setLabel(
            'Khóa',
          )
          .setEmoji(
            JTC_EMOJIS.privacy,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /**
         * MỞ KHÓA
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:unlock',
          )
          .setLabel(
            'Mở khóa',
          )
          .setEmoji(
            JTC_EMOJIS.privacy,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /**
         * ẨN PHÒNG
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:hide',
          )
          .setLabel(
            'Ẩn phòng',
          )
          .setEmoji(
            JTC_EMOJIS.privacy,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  /**
   * =======================================================
   * ROW 2
   * =======================================================
   *
   * Hiện phòng
   * Cho phép
   * Chặn
   * Kick
   * Chuyển chủ
   */

  const row2 =
    new ActionRowBuilder()
      .addComponents(
        /**
         * HIỆN PHÒNG
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:show',
          )
          .setLabel(
            'Hiện phòng',
          )
          .setEmoji(
            JTC_EMOJIS.allow,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /**
         * CHO PHÉP
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:allow',
          )
          .setLabel(
            'Cho phép',
          )
          .setEmoji(
            JTC_EMOJIS.allow,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /**
         * CHẶN
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:block',
          )
          .setLabel(
            'Chặn',
          )
          .setEmoji(
            JTC_EMOJIS.block,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /**
         * KICK
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:kick',
          )
          .setLabel(
            'Kick',
          )
          .setEmoji(
            JTC_EMOJIS.block,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /**
         * CHUYỂN CHỦ
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:transfer',
          )
          .setLabel(
            'Chuyển chủ',
          )
          .setEmoji(
            JTC_EMOJIS.transfer,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  /**
   * =======================================================
   * ROW 3
   * =======================================================
   *
   * Region
   * Xóa phòng
   */

  const row3 =
    new ActionRowBuilder()
      .addComponents(
        /**
         * REGION
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:region',
          )
          .setLabel(
            'Region',
          )
          .setEmoji(
            JTC_EMOJIS.region,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        /**
         * XÓA PHÒNG
         */

        new ButtonBuilder()
          .setCustomId(
            'jtc_room:delete',
          )
          .setLabel(
            'Xóa phòng',
          )
          .setEmoji(
            JTC_EMOJIS.delete,
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
   * =======================================================
   * DELETE OLD PANEL
   * =======================================================
   *
   * Nếu panel cũ vẫn còn tồn tại,
   * xóa message cũ trước khi tạo message mới.
   *
   * Điều này tránh việc một server có nhiều
   * bảng điều khiển Join to Create giống nhau.
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
   * =======================================================
   * BUILD PANEL
   * =======================================================
   */

  const payload =
    buildJoinToCreateControlPanel();

  /**
   * =======================================================
   * SEND PANEL
   * =======================================================
   */

  const panelMessage =
    await channel.send(
      payload,
    );

  /**
   * =======================================================
   * SAVE PANEL LOCATION
   * =======================================================
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

/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default {
  buildJoinToCreateControlPanel,
  createJoinToCreateControlPanel,
};
