import {
  ActionRowBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import {
  getJoinToCreateConfig,
  saveJoinToCreateConfig,
  unregisterTemporaryChannel,
} from '../utils/database.js';

import {
  logger,
} from '../utils/logger.js';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

async function replyEphemeral(
  interaction,
  content,
) {
  if (
    interaction.deferred ||
    interaction.replied
  ) {
    return interaction.followUp({
      content,
      flags:
        MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({
    content,
    flags:
      MessageFlags.Ephemeral,
  });
}

/**
 * =========================================================
 * FIND ROOM OWNED BY USER
 * =========================================================
 */

async function getOwnedRoom(
  interaction,
  client,
) {
  if (
    !interaction.guild ||
    !interaction.user
  ) {
    return null;
  }

  const config =
    await getJoinToCreateConfig(
      client,
      interaction.guild.id,
    );

  const temporaryChannels =
    config.temporaryChannels ||
    {};

  for (
    const [
      channelId,
      info,
    ] of Object.entries(
      temporaryChannels,
    )
  ) {
    if (
      info?.ownerId !==
      interaction.user.id
    ) {
      continue;
    }

    const channel =
      await interaction.guild.channels
        .fetch(channelId)
        .catch(() => null);

    if (
      !channel ||
      channel.type !==
        ChannelType.GuildVoice
    ) {
      continue;
    }

    return {
      channel,
      info,
      config,
    };
  }

  return null;
}

/**
 * =========================================================
 * REQUIRE OWNER
 * =========================================================
 */

async function requireOwnedRoom(
  interaction,
  client,
) {
  const result =
    await getOwnedRoom(
      interaction,
      client,
    );

  if (!result) {
    await replyEphemeral(
      interaction,
      '🐰 Bạn chưa sở hữu phòng Voice tạm thời nào. Hãy vào **Tạo Kênh Voice Riêng** trước nhé!',
    );

    return null;
  }

  return result;
}

/**
 * =========================================================
 * PARSE USER
 * =========================================================
 */

function parseUserId(value) {
  if (!value) {
    return null;
  }

  const match =
    String(value).match(
      /\d{17,20}/,
    );

  return match
    ? match[0]
    : null;
}

/**
 * =========================================================
 * SHOW TARGET MODAL
 * =========================================================
 */

async function showTargetModal(
  interaction,
  action,
  title,
  label,
) {
  const input =
    new TextInputBuilder()
      .setCustomId('user')
      .setLabel(label)
      .setPlaceholder(
        'Dán @mention hoặc User ID',
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setRequired(true);

  const row =
    new ActionRowBuilder()
      .addComponents(input);

  const modal =
    new ModalBuilder()
      .setCustomId(
        `jtc_room_modal:${action}`,
      )
      .setTitle(title)
      .addComponents(row);

  await interaction.showModal(
    modal,
  );
}

/**
 * =========================================================
 * BUTTON
 * =========================================================
 */

async function handleButton(
  interaction,
  client,
) {
  const action =
    interaction.customId
      .split(':')[1];

  /**
   * Kiểm tra ownership trước
   * mọi action.
   */

  const owned =
    await requireOwnedRoom(
      interaction,
      client,
    );

  if (!owned) {
    return true;
  }

  const {
    channel,
  } = owned;

  switch (action) {
    /**
     * -------------------------------------------------------
     * RENAME
     * -------------------------------------------------------
     */

    case 'name': {
      const input =
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel(
            'Tên phòng mới',
          )
          .setPlaceholder(
            'Ví dụ: 🌸・Phòng của Usagi',
          )
          .setStyle(
            TextInputStyle.Short,
          )
          .setMaxLength(100)
          .setRequired(true);

      const modal =
        new ModalBuilder()
          .setCustomId(
            'jtc_room_modal:name',
          )
          .setTitle(
            '🐰 Đổi tên phòng',
          )
          .addComponents(
            new ActionRowBuilder()
              .addComponents(input),
          );

      await interaction.showModal(
        modal,
      );

      return true;
    }

    /**
     * -------------------------------------------------------
     * LIMIT
     * -------------------------------------------------------
     */

    case 'limit': {
      const input =
        new TextInputBuilder()
          .setCustomId('limit')
          .setLabel(
            'Giới hạn thành viên',
          )
          .setPlaceholder(
            '0 = không giới hạn, tối đa 99',
          )
          .setStyle(
            TextInputStyle.Short,
          )
          .setValue(
            String(
              channel.userLimit ||
              0,
            ),
          )
          .setRequired(true);

      const modal =
        new ModalBuilder()
          .setCustomId(
            'jtc_room_modal:limit',
          )
          .setTitle(
            '👥 Giới hạn phòng',
          )
          .addComponents(
            new ActionRowBuilder()
              .addComponents(input),
          );

      await interaction.showModal(
        modal,
      );

      return true;
    }

    /**
     * -------------------------------------------------------
     * LOCK
     * -------------------------------------------------------
     */

    case 'lock': {
      await channel.permissionOverwrites
        .edit(
          interaction.guild.id,
          {
            Connect: false,
          },
        );

      await replyEphemeral(
        interaction,
        '🔒 Đã khóa phòng. Thành viên mới sẽ không thể tự tham gia.',
      );

      return true;
    }

    /**
     * -------------------------------------------------------
     * UNLOCK
     * -------------------------------------------------------
     */

    case 'unlock': {
      await channel.permissionOverwrites
        .edit(
          interaction.guild.id,
          {
            Connect: true,
          },
        );

      await replyEphemeral(
        interaction,
        '🔓 Phòng đã được mở khóa.',
      );

      return true;
    }

    /**
     * -------------------------------------------------------
     * HIDE
     * -------------------------------------------------------
     */

    case 'hide': {
      await channel.permissionOverwrites
        .edit(
          interaction.guild.id,
          {
            ViewChannel:
              false,
          },
        );

      /**
       * Owner vẫn nhìn thấy.
       */

      await channel.permissionOverwrites
        .edit(
          interaction.user.id,
          {
            ViewChannel:
              true,

            Connect:
              true,
          },
        );

      await replyEphemeral(
        interaction,
        '🙈 Đã ẩn phòng khỏi các thành viên khác.',
      );

      return true;
    }

    /**
     * -------------------------------------------------------
     * SHOW
     * -------------------------------------------------------
     */

    case 'show': {
      await channel.permissionOverwrites
        .edit(
          interaction.guild.id,
          {
            ViewChannel:
              true,
          },
        );

      await replyEphemeral(
        interaction,
        '👁️ Phòng đã được hiển thị trở lại.',
      );

      return true;
    }

    /**
     * -------------------------------------------------------
     * ALLOW
     * -------------------------------------------------------
     */

    case 'allow':
      await showTargetModal(
        interaction,
        'allow',
        '💌 Cho phép thành viên',
        'Thành viên được phép vào',
      );

      return true;

    /**
     * -------------------------------------------------------
     * BLOCK
     * -------------------------------------------------------
     */

    case 'block':
      await showTargetModal(
        interaction,
        'block',
        '🚫 Chặn thành viên',
        'Thành viên muốn chặn',
      );

      return true;

    /**
     * -------------------------------------------------------
     * KICK
     * -------------------------------------------------------
     */

    case 'kick':
      await showTargetModal(
        interaction,
        'kick',
        '👢 Kick khỏi phòng',
        'Thành viên muốn kick',
      );

      return true;

    /**
     * -------------------------------------------------------
     * TRANSFER
     * -------------------------------------------------------
     */

    case 'transfer':
      await showTargetModal(
        interaction,
        'transfer',
        '👑 Chuyển chủ phòng',
        'Chủ phòng mới',
      );

      return true;

    /**
     * -------------------------------------------------------
     * REGION
     * -------------------------------------------------------
     */

    case 'region': {
      const select =
        new StringSelectMenuBuilder()
          .setCustomId(
            'jtc_room_region',
          )
          .setPlaceholder(
            '🌏 Chọn Voice Region',
          )
          .addOptions(
            {
              label:
                'Automatic',
              value:
                'automatic',
              emoji:
                '🌐',
            },
            {
              label:
                'Singapore',
              value:
                'singapore',
              emoji:
                '🇸🇬',
            },
            {
              label:
                'Hong Kong',
              value:
                'hongkong',
              emoji:
                '🇭🇰',
            },
            {
              label:
                'Japan',
              value:
                'japan',
              emoji:
                '🇯🇵',
            },
            {
              label:
                'Sydney',
              value:
                'sydney',
              emoji:
                '🇦🇺',
            },
            {
              label:
                'India',
              value:
                'india',
              emoji:
                '🇮🇳',
            },
          );

      await interaction.reply({
        content:
          '🌏 Chọn region cho phòng của bạn:',

        components: [
          new ActionRowBuilder()
            .addComponents(
              select,
            ),
        ],

        flags:
          MessageFlags.Ephemeral,
      });

      return true;
    }

    /**
     * -------------------------------------------------------
     * DELETE
     * -------------------------------------------------------
     */

    case 'delete': {
      const guildId =
        interaction.guild.id;

      const channelId =
        channel.id;

      await interaction.reply({
        content:
          '🗑️ Đang xóa phòng Voice của bạn...',

        flags:
          MessageFlags.Ephemeral,
      });

      await unregisterTemporaryChannel(
        client,
        guildId,
        channelId,
      );

      await channel
        .delete(
          `Temporary voice room deleted by owner ${interaction.user.id}`,
        )
        .catch(
          () => {},
        );

      return true;
    }

    default:
      return false;
  }
}

/**
 * =========================================================
 * MODAL
 * =========================================================
 */

async function handleModal(
  interaction,
  client,
) {
  const action =
    interaction.customId
      .split(':')[1];

  const owned =
    await requireOwnedRoom(
      interaction,
      client,
    );

  if (!owned) {
    return true;
  }

  const {
    channel,
    config,
  } = owned;

  /**
   * -------------------------------------------------------
   * NAME
   * -------------------------------------------------------
   */

  if (action === 'name') {
    const name =
      interaction.fields
        .getTextInputValue(
          'name',
        )
        .replace(
          /[\r\n\t]/g,
          ' ',
        )
        .replace(
          /\s+/g,
          ' ',
        )
        .trim()
        .slice(
          0,
          100,
        );

    if (!name) {
      await replyEphemeral(
        interaction,
        '❌ Tên phòng không hợp lệ.',
      );

      return true;
    }

    await channel.setName(
      name,
      `Temporary voice room renamed by ${interaction.user.id}`,
    );

    await replyEphemeral(
      interaction,
      `✏️ Đã đổi tên phòng thành **${name}**.`,
    );

    return true;
  }

  /**
   * -------------------------------------------------------
   * LIMIT
   * -------------------------------------------------------
   */

  if (action === 'limit') {
    const value =
      interaction.fields
        .getTextInputValue(
          'limit',
        );

    const limit =
      Number(value);

    if (
      !Number.isInteger(
        limit,
      ) ||
      limit < 0 ||
      limit > 99
    ) {
      await replyEphemeral(
        interaction,
        '❌ Giới hạn phải là số từ **0–99**. `0` = không giới hạn.',
      );

      return true;
    }

    await channel.setUserLimit(
      limit,
    );

    await replyEphemeral(
      interaction,
      limit === 0
        ? '👥 Đã đặt phòng thành **không giới hạn thành viên**.'
        : `👥 Giới hạn phòng đã được đặt thành **${limit} người**.`,
    );

    return true;
  }

  /**
   * -------------------------------------------------------
   * TARGET USER ACTIONS
   * -------------------------------------------------------
   */

  const rawUser =
    interaction.fields
      .getTextInputValue(
        'user',
      );

  const targetId =
    parseUserId(
      rawUser,
    );

  if (!targetId) {
    await replyEphemeral(
      interaction,
      '❌ Không tìm thấy User ID hợp lệ. Bạn có thể dán @mention hoặc User ID.',
    );

    return true;
  }

  if (
    targetId ===
    interaction.user.id
  ) {
    await replyEphemeral(
      interaction,
      '❌ Bạn không thể thực hiện thao tác này với chính mình.',
    );

    return true;
  }

  const targetMember =
    await interaction.guild.members
      .fetch(targetId)
      .catch(
        () => null,
      );

  if (!targetMember) {
    await replyEphemeral(
      interaction,
      '❌ Không tìm thấy thành viên này trong server.',
    );

    return true;
  }

  /**
   * -------------------------------------------------------
   * ALLOW
   * -------------------------------------------------------
   */

  if (action === 'allow') {
    await channel.permissionOverwrites
      .edit(
        targetId,
        {
          ViewChannel:
            true,

          Connect:
            true,

          Speak:
            true,
        },
      );

    await replyEphemeral(
      interaction,
      `💌 Đã cho phép <@${targetId}> tham gia phòng.`,
    );

    return true;
  }

  /**
   * -------------------------------------------------------
   * BLOCK
   * -------------------------------------------------------
   */

  if (action === 'block') {
    await channel.permissionOverwrites
      .edit(
        targetId,
        {
          Connect:
            false,
        },
      );

    if (
      targetMember.voice
        ?.channelId ===
      channel.id
    ) {
      await targetMember.voice
        .disconnect(
          'Blocked from temporary voice room',
        )
        .catch(
          () => {},
        );
    }

    await replyEphemeral(
      interaction,
      `🚫 Đã chặn <@${targetId}> khỏi phòng.`,
    );

    return true;
  }

  /**
   * -------------------------------------------------------
   * KICK
   * -------------------------------------------------------
   */

  if (action === 'kick') {
    if (
      targetMember.voice
        ?.channelId !==
      channel.id
    ) {
      await replyEphemeral(
        interaction,
        '❌ Thành viên này hiện không ở trong phòng của bạn.',
      );

      return true;
    }

    await targetMember.voice
      .disconnect(
        'Removed from temporary voice room by owner',
      );

    await replyEphemeral(
      interaction,
      `👢 Đã kick <@${targetId}> khỏi phòng.`,
    );

    return true;
  }

  /**
   * -------------------------------------------------------
   * TRANSFER OWNER
   * -------------------------------------------------------
   */

  if (
    action ===
    'transfer'
  ) {
    if (
      targetMember.voice
        ?.channelId !==
      channel.id
    ) {
      await replyEphemeral(
        interaction,
        '❌ Chủ phòng mới phải đang ở trong phòng Voice của bạn.',
      );

      return true;
    }

    const info =
      config
        .temporaryChannels
        ?.[channel.id];

    if (!info) {
      await replyEphemeral(
        interaction,
        '❌ Không tìm thấy dữ liệu phòng tạm.',
      );

      return true;
    }

    info.ownerId =
      targetId;

    /**
     * Chủ cũ mất quyền đặc biệt.
     */

    await channel.permissionOverwrites
      .delete(
        interaction.user.id,
      )
      .catch(
        () => {},
      );

    /**
     * Chủ mới có quyền điều khiển.
     */

    await channel.permissionOverwrites
      .edit(
        targetId,
        {
          ViewChannel:
            true,

          Connect:
            true,

          Speak:
            true,

          PrioritySpeaker:
            true,

          MoveMembers:
            true,
        },
      );

    await saveJoinToCreateConfig(
      client,
      interaction.guild.id,
      config,
    );

    await replyEphemeral(
      interaction,
      `👑 Đã chuyển quyền sở hữu phòng cho <@${targetId}>.`,
    );

    return true;
  }

  return false;
}

/**
 * =========================================================
 * REGION SELECT
 * =========================================================
 */

async function handleRegion(
  interaction,
  client,
) {
  const owned =
    await requireOwnedRoom(
      interaction,
      client,
    );

  if (!owned) {
    return true;
  }

  const region =
    interaction.values[0];

  await owned.channel.setRTCRegion(
    region === 'automatic'
      ? null
      : region,
  );

  await interaction.update({
    content:
      region ===
      'automatic'
        ? '🌐 Voice Region đã chuyển về **Automatic**.'
        : `🌏 Voice Region đã chuyển sang **${region}**.`,

    components: [],
  });

  return true;
}

/**
 * =========================================================
 * MAIN HANDLER
 * =========================================================
 */

export async function handleJoinToCreateControl(
  interaction,
  client,
) {
  try {
    if (
      interaction.isButton() &&
      interaction.customId
        ?.startsWith(
          'jtc_room:',
        )
    ) {
      return await handleButton(
        interaction,
        client,
      );
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId
        ?.startsWith(
          'jtc_room_modal:',
        )
    ) {
      return await handleModal(
        interaction,
        client,
      );
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId ===
        'jtc_room_region'
    ) {
      return await handleRegion(
        interaction,
        client,
      );
    }

    return false;
  } catch (error) {
    logger.error(
      'Join to Create control error:',
      error,
    );

    await replyEphemeral(
      interaction,
      '❌ Không thể thực hiện thao tác này. Vui lòng thử lại.',
    ).catch(
      () => {},
    );

    return true;
  }
}
