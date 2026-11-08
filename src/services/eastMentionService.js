import {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  EmbedBuilder,
} from 'discord.js';
import { logger } from '../utils/logger.js';

export const EAST_USER_ID = '872792190651334707';

const EAST_MENTION_REGEX = new RegExp(`<@!?${EAST_USER_ID}>`);

// Cooldown 3 giây giữa mỗi lần một người dùng ping để chống spam
const COOLDOWN_MS = 3000;
const userCooldowns = new Map();

/**
 * Tự động phản hồi khi có thành viên ping riêng East trên server Discord.
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>}
 */
export async function handleEastMention(message) {
  try {
    if (!message.guild || message.author.bot) {
      return false;
    }

    // Không kích hoạt nếu chính chủ tự ping
    if (message.author.id === EAST_USER_ID) {
      return false;
    }

    // Chỉ kích hoạt khi người dùng thực sự gõ @East trong nội dung tin nhắn (<@ID> hoặc <@!ID>),
    // tuyệt đối KHÔNG kích hoạt khi người dùng chỉ đơn thuần reply (trả lời) tin nhắn của East.
    if (!EAST_MENTION_REGEX.test(message.content || '')) {
      return false;
    }

    // Kiểm tra xem Discord có nhận diện hợp lệ ping tới East không
    if (!message.mentions.users.has(EAST_USER_ID)) {
      return false;
    }

    // Kiểm tra cooldown chống spam cho người gửi
    const now = Date.now();
    const lastTrigger = userCooldowns.get(message.author.id) || 0;
    if (now - lastTrigger < COOLDOWN_MS) {
      return false;
    }
    userCooldowns.set(message.author.id, now);

    // Dọn dẹp cache cooldown định kỳ nếu Map lớn
    if (userCooldowns.size > 1000) {
      const expiry = now - 10000;
      for (const [userId, timestamp] of userCooldowns.entries()) {
        if (timestamp < expiry) {
          userCooldowns.delete(userId);
        }
      }
    }

    // Giao diện Components V2 (ContainerBuilder), không title, màu mặc định
    const replyContent =
      `Cảm ơn <@${message.author.id}> đã ping xì trum chúa của server, chúc bạn một ngày tốt lành! <a:bunnyg4:1541439959385374760>\n` +
      `> <@${EAST_USER_ID}> sẽ phản hồi ngay khi online. <a:chiikawag12:1541429044287897632>`;

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(replyContent),
    );

    const fallbackEmbed = new EmbedBuilder().setDescription(replyContent);

    let sent = false;
    try {
      await message
        .reply({
          content: null,
          embeds: [],
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false },
        })
        .catch(async () => {
          await message.channel.send({
            content: null,
            embeds: [],
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        });
      sent = true;
    } catch (v2Error) {
      logger.warn('[EastMention] Không thể gửi bằng Components V2, dùng fallback embed:', v2Error);
    }

    if (!sent) {
      await message
        .reply({
          embeds: [fallbackEmbed],
          allowedMentions: { repliedUser: false },
        })
        .catch(async () => {
          await message.channel.send({ embeds: [fallbackEmbed] }).catch(() => {});
        });
    }

    logger.info(
      `[EastMention] Đã phản hồi tự động khi ${message.author.tag} (${message.author.id}) ping East trong guild ${message.guild.id}`,
    );

    return true;
  } catch (error) {
    logger.error('[EastMention] Lỗi xử lý tự động phản hồi khi ping East:', error);
    return false;
  }
}
