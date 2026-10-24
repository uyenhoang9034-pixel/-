import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import {
  WITCH_HUNTER_CONFIG,
  getSupporterByRank,
} from '../../config/witchHunterConfig.js';
import { WitchHunterService, witchHunterStorage } from '../../services/witchHunterService.js';
import { logger } from '../../utils/logger.js';

function isWitchHunterAdmin(interaction) {
  const member = interaction.member;
  if (!member) return false;

  const ownerId = interaction.guild?.ownerId;
  if (ownerId && (interaction.user?.id === ownerId || member.id === ownerId)) {
    return true;
  }

  const configuredOwnerIds = (process.env.OWNER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (configuredOwnerIds.includes(interaction.user?.id) || configuredOwnerIds.includes(member.id)) {
    return true;
  }

  const adminRole = WITCH_HUNTER_CONFIG.adminRoleId;
  if (member.roles?.cache?.has?.(adminRole)) return true;
  if (Array.isArray(member._roles) && member._roles.includes(adminRole)) return true;
  if (Array.isArray(member.roles) && member.roles.includes(adminRole)) return true;

  return false;
}

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Tra cứu hồ sơ cá nhân, cấp bậc và khế ước Supporter Witch Hunter')
    .addUserOption((opt) =>
      opt
        .setName('thanh-vien')
        .setDescription('Thành viên muốn tra cứu hồ sơ (để trống để xem hồ sơ của chính mình)')
        .setRequired(false)
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      const guild = interaction.guild;
      const caller = interaction.member;
      const callerUser = interaction.user;

      if (!guild || !caller) {
        return interaction.reply({
          content: 'Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const isAdmin = isWitchHunterAdmin(interaction);

      // Phân quyền kênh cố định:
      // - ADMIN có role 1541303749916754001 hoặc Owner: CÓ THỂ DÙNG Ở BẤT CỨ KÊNH NÀO để test tiện lợi
      // - Thành viên bình thường: bắt buộc đúng kênh theo phe
      if (!isAdmin) {
        let callerData = witchHunterStorage.getUser(callerUser.id);
        let callerFaction = callerData?.faction;

        // Nếu database chưa kịp lưu phe, đối chiếu từ role Discord hiện có
        if (!callerFaction && caller.roles?.cache) {
          for (const roleId of Object.values(WITCH_HUNTER_CONFIG.roles.hunter)) {
            if (caller.roles.cache.has(roleId)) {
              callerFaction = 'hunter';
              break;
            }
          }
          if (!callerFaction) {
            for (const roleId of Object.values(WITCH_HUNTER_CONFIG.roles.witch)) {
              if (caller.roles.cache.has(roleId)) {
                callerFaction = 'witch';
                break;
              }
            }
          }
        }

        // Trường hợp chưa gia nhập phe nào
        if (!callerFaction) {
          return interaction.reply({
            content: `❌ Lữ khách chưa ký khế ước chọn phe nào trong thế giới Witch Hunter!\nHãy ghé qua kênh <#${WITCH_HUNTER_CONFIG.channels.selectionChannelId}> để ký khế ước trước nha lữ khách ơi! 💕`,
            flags: MessageFlags.Ephemeral,
          });
        }

        // Ràng buộc Phe Thợ Săn: Chỉ được dùng ở kênh 1563385216800657479
        if (callerFaction === 'hunter') {
          const requiredHunterChannel = WITCH_HUNTER_CONFIG.channels.hunterChannelId;
          if (interaction.channelId !== requiredHunterChannel) {
            return interaction.reply({
              content: `❌ Lệnh tra cứu Hồ Sơ của **Hiệp Hội Thợ Săn** chỉ có thể sử dụng tại kênh <#${requiredHunterChannel}> thôi nè lữ khách ơi! 💕`,
              flags: MessageFlags.Ephemeral,
            });
          }
        }

        // Ràng buộc Phe Phù Thủy: Chỉ được dùng ở kênh 1563385150660808846
        if (callerFaction === 'witch') {
          const requiredWitchChannel = WITCH_HUNTER_CONFIG.channels.witchChannelId;
          if (interaction.channelId !== requiredWitchChannel) {
            return interaction.reply({
              content: `❌ Lệnh tra cứu Hồ Sơ của **Hội Phù Thủy** chỉ có thể sử dụng tại kênh <#${requiredWitchChannel}> thôi nè lữ khách ơi! 💕`,
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      }

      const targetUser = interaction.options.getUser('thanh-vien') || callerUser;
      const userId = targetUser.id;

      let guildMember = null;
      if (guild) {
        guildMember = guild.members.cache.get(userId) ||
          await guild.members.fetch(userId).catch(() => null);
      }

      // 1. Lấy dữ liệu người dùng từ Database
      let userData = WitchHunterService.getUserProfile(userId);
      let faction = userData?.faction || null;
      let currentRank = userData?.current_rank || 1;
      let pumpkins = userData?.pumpkins || 0;

      // 2. CƠ CHẾ TỰ ĐỘNG KHÔI PHỤC HỒ SƠ TỪ ROLE TRÊN DISCORD NẾU DATABASE CHƯA ĐỒNG BỘ:
      if (guildMember?.roles?.cache) {
        let detectedFaction = null;
        let detectedRank = 1;

        // Quét role Thợ Săn
        for (const [rStr, rId] of Object.entries(WITCH_HUNTER_CONFIG.roles.hunter)) {
          if (guildMember.roles.cache.has(rId)) {
            detectedFaction = 'hunter';
            detectedRank = Math.max(detectedRank, Number(rStr));
          }
        }

        // Quét role Phù Thủy
        if (!detectedFaction) {
          for (const [rStr, rId] of Object.entries(WITCH_HUNTER_CONFIG.roles.witch)) {
            if (guildMember.roles.cache.has(rId)) {
              detectedFaction = 'witch';
              detectedRank = Math.max(detectedRank, Number(rStr));
            }
          }
        }

        if (detectedFaction) {
          faction = detectedFaction;
          currentRank = Math.max(currentRank, detectedRank);

          if (!userData) {
            userData = {
              user_id: userId,
              faction,
              current_rank: currentRank,
              pumpkins: 0,
              unlocked_supporters: [`${faction}:${currentRank}`],
            };
            witchHunterStorage.saveUser(userData, true);
          }
        }
      }

      const { emojis, colors, channels } = WITCH_HUNTER_CONFIG;

      const decor45Emoji = emojis.decor45 || '<a:trangtrig45:1547239010190237819>';
      const decor30Emoji = emojis.decor30 || '<a:trangtrig30:1546905942476464178>';
      const decor34Emoji = emojis.decor34 || '<a:trangtrig34:1547237010572582982>';
      const decor21Emoji = emojis.decor21 || '<a:trangtrig21:1546093099770716213>';
      const defaultLinhTocEmoji = emojis.linhtoc || '<a:linhtocg:1563399670351536310>';
      const heartEmoji = emojis.heart || '<a:heartg1:1545307544808071258>';

      // 3. TRƯỜNG HỢP CHƯA KÝ KHẾ ƯỚC CHỌN PHE
      if (!faction) {
        const unassignedEmbed = new EmbedBuilder()
          .setColor(colors.pastelPurple) // Cố định màu tím pastel nhạt nhạt
          .setTitle(`${emojis.titleLeft} 𝓗𝓸̂̀ 𝓢𝓸̛ 𝓒𝓪́ 𝓝𝓱𝓪̂𝓷: ${targetUser.username} ${emojis.titleRight}`)
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
          .setDescription(
            `Chào **${targetUser.username}**! Hiện tại lữ khách **chưa ký khế ước gia nhập phe phái** nào trong thế giới **Witch Hunter**.\n\n` +
            `${emojis.pumpkin} **Bí Ngô tích lũy:** **${pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
            `${decor34Emoji} **Phe phái:** *Chưa phân định...*\n` +
            `${decor45Emoji} **Cấp bậc:** *Chưa phân định*\n` +
            `${defaultLinhTocEmoji} **Supporter Khế Ước:** *Chưa ký kết khế ước*\n\n` +
            `${decor30Emoji} **Lời nhắn từ Phù Thủy Usagi:**\n` +
            `> Hãy ghé qua kênh <#${channels.selectionChannelId}> nhận role danh hiệu ngay nha Lữ Khách ơi! ${heartEmoji}`
          )
          .setFooter({
            text: 'Witch Hunter Profile',
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [unassignedEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // 4. TRƯỜNG HỢP ĐÃ GIA NHẬP PHE
      const isHunter = faction === 'hunter';
      const factionDisplay = isHunter
        ? `${emojis.hunterButton} **Phe phái:** **Hiệp Hội Thợ Săn**`
        : `${emojis.witchButton} **Phe phái:** **Phe Phù Thủy**`;

      const progress = WitchHunterService.getProgressDetails(faction, pumpkins, currentRank);
      const rankInfo = WitchHunterService.getRankInfo(faction, currentRank);

      // Tra cứu Supporter tương ứng theo phe và rank hiện tại
      const supporter = getSupporterByRank(faction, currentRank);
      let supporterLine = `${defaultLinhTocEmoji} **Supporter Khế Ước:** *Chưa ký kết khế ước*`;
      if (supporter) {
        const cat = WITCH_HUNTER_CONFIG.supporters.categories[supporter.categoryKey];
        const catEmoji = cat?.emoji || defaultLinhTocEmoji;
        supporterLine = `${catEmoji} **Supporter Khế Ước:** **${supporter.name}** *(${cat?.shortName || ''})*`;
      }

      const progressText = progress.isMax
        ? `${progress.formattedStatus}`
        : `> ${progress.formattedStatus}`;

      const profileEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple) // Cố định màu tím pastel nhạt nhạt
        .setTitle(`${emojis.titleLeft} 𝓗𝓸̂̀ 𝓢𝓸̛ 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽: ${targetUser.username} ${emojis.titleRight}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription(
          `Chiến binh huyền thoại của thế giới ma thuật **Witch Hunter**:\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${emojis.pumpkin} **Bí Ngô sở hữu:** **${pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
          `${factionDisplay}\n` +
          `${decor45Emoji} **Cấp bậc:** **${rankInfo.name}** *(${rankInfo.title})*\n` +
          `${supporterLine}\n\n` +
          `${decor21Emoji} **Tiến trình đột phá bậc kế tiếp:**\n` +
          `${progress.progressBar}\n` +
          `${progressText}\n\n` +
          `${decor30Emoji} **Lời nhắn từ Phù Thủy Usagi:**\n` +
          `> Hãy ghé qua kênh <#${channels.selectionChannelId}> nhận role danh hiệu ngay nha Lữ Khách ơi! ${heartEmoji}`
        )
        .setFooter({
          text: 'Witch Hunter Profile',
        })
        .setTimestamp();

      return interaction.reply({
        embeds: [profileEmbed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi lệnh profile:', error);
      return interaction.reply({
        content: `Đã xảy ra lỗi khi tra cứu hồ sơ: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
