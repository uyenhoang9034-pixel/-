import {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  EmbedBuilder,
} from 'discord.js';
import { logger } from '../utils/logger.js';

export const EAST_USER_ID = '872792190651334707';
export const TE_TINH_XUAN_USER_ID = '1206193798804144169';
export const PRINCESS_USER_ID = '852947314481299516';

// Cấu hình các profile tự động phản hồi khi được ping
export const MENTION_PROFILES = [
  {
    userId: EAST_USER_ID,
    name: 'East',
    regex: new RegExp(`<@!?${EAST_USER_ID}>`),
    getContent: (message) =>
      `Cảm ơn <@${message.author.id}> đã ping xì trum chúa của server, chúc bạn một ngày tốt lành! <a:bunnyg4:1541439959385374760>\n` +
      `> <@${EAST_USER_ID}> sẽ phản hồi ngay khi online. <a:chiikawag12:1541429044287897632>`,
  },
  {
    userId: TE_TINH_XUAN_USER_ID,
    name: 'Tề Tĩnh Xuân',
    regex: new RegExp(`<@!?${TE_TINH_XUAN_USER_ID}>`),
    getContent: () =>
      `Tề gia trị quốc\n` +
      `Tĩnh tâm đắc ý\n` +
      `thiên hạ nghênh Xuân.\n` +
      `> <@${TE_TINH_XUAN_USER_ID}> sẽ phản hồi ngay khi online!`,
  },
  {
    userId: PRINCESS_USER_ID,
    name: 'Công chúa',
    regex: new RegExp(`<@!?${PRINCESS_USER_ID}>`),
    getContent: () =>
      `Công chúa <@${PRINCESS_USER_ID}> đang ngủ trên giường òi, hoàng tử đợi công chúa dậy công chúa trả lời ngay nha. <a:heartg8:1567818755793358928>`,
  },
];

// Cooldown 3 giây giữa mỗi lần một người dùng ping để chống spam
const COOLDOWN_MS = 3000;
const userCooldowns = new Map();

/**
 * Gửi phản hồi Components V2 (kèm fallback Embed)
 * @param {import('discord.js').Message} message
 * @param {string} replyContent
 */
async function sendV2Reply(message, replyContent) {
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
}

/**
 * Tự động phản hồi khi có thành viên ping riêng East hoặc Tề Tĩnh Xuân trên server Discord.
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>}
 */
export async function handleEastMention(message) {
  try {
    if (!message.guild || message.author.bot) {
      return false;
    }

    const content = message.content || '';
    let handled = false;

    for (const profile of MENTION_PROFILES) {
      // Không kích hoạt nếu chính chủ tự ping
      if (message.author.id === profile.userId) {
        continue;
      }

      // Chỉ kích hoạt khi người dùng thực sự gõ @ID trong nội dung tin nhắn (<@ID> hoặc <@!ID>),
      // tuyệt đối KHÔNG kích hoạt khi người dùng chỉ đơn thuần reply (trả lời) tin nhắn.
      if (!profile.regex.test(content)) {
        continue;
      }

      // Kiểm tra xem Discord có nhận diện hợp lệ ping tới target user không
      if (!message.mentions.users.has(profile.userId)) {
        continue;
      }

      // Kiểm tra cooldown chống spam cho người gửi đối với profile này
      const now = Date.now();
      const cooldownKey = `${message.author.id}_${profile.userId}`;
      const lastTrigger = userCooldowns.get(cooldownKey) || 0;
      if (now - lastTrigger < COOLDOWN_MS) {
        continue;
      }
      userCooldowns.set(cooldownKey, now);

      // Dọn dẹp cache cooldown định kỳ nếu Map lớn
      if (userCooldowns.size > 1000) {
        const expiry = now - 10000;
        for (const [key, timestamp] of userCooldowns.entries()) {
          if (timestamp < expiry) {
            userCooldowns.delete(key);
          }
        }
      }

      const replyContent = profile.getContent(message);
      await sendV2Reply(message, replyContent);

      logger.info(
        `[EastMention] Đã phản hồi tự động khi ${message.author.tag} (${message.author.id}) ping ${profile.name} (${profile.userId}) trong guild ${message.guild.id}`,
      );

      handled = true;
    }

    return handled;
  } catch (error) {
    logger.error('[EastMention] Lỗi xử lý tự động phản hồi khi ping:', error);
    return false;
  }
}

export const handleCustomMentions = handleEastMention;

