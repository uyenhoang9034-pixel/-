import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord.js';
import { 
    getGuildGiveaways, 
    saveGiveaway, 
    isGiveawayEnded,
    getGuildGiveawayBlacklist,
    addGuildGiveawayBlacklist,
    removeGuildGiveawayBlacklist
} from '../../utils/giveaways.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { Mutex } from '../../utils/mutex.js';

const GIVEAWAY_ADMIN_ROLE_ID = '1541303749916754001';

export default {
    data: new SlashCommandBuilder()
        .setName('gblacklist')
        .setDescription('Quản lý danh sách loại trừ người trúng thưởng giveaway (vẫn tham gia được nhưng không trúng).')
        .addSubcommand((subcommand) =>
            subcommand
                .setName('add')
                .setDescription('Thêm một người vào danh sách không thể trúng thưởng giveaway.')
                .addUserOption((option) =>
                    option
                        .setName('user')
                        .setDescription('Người dùng cần loại trừ không cho trúng giải.')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('userid')
                        .setDescription('User ID cần loại trừ (nếu không tag/chọn được user).')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('messageid')
                        .setDescription('Message ID giveaway cụ thể (Bỏ trống = áp dụng cho TOÀN BỘ giveaway trong server).')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription('Lý do loại trừ khỏi danh sách trúng thưởng.')
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Xóa một người khỏi danh sách loại trừ trúng thưởng.')
                .addUserOption((option) =>
                    option
                        .setName('user')
                        .setDescription('Người dùng cần gỡ khỏi danh sách loại trừ.')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('userid')
                        .setDescription('User ID cần gỡ (nếu không tag/chọn được user).')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('messageid')
                        .setDescription('Message ID giveaway cụ thể (Bỏ trống = gỡ khỏi danh sách toàn server).')
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('list')
                .setDescription('Xem danh sách người bị loại trừ khỏi quay thưởng giveaway.')
                .addStringOption((option) =>
                    option
                        .setName('messageid')
                        .setDescription('Message ID giveaway cụ thể (Bỏ trống = xem danh sách toàn server).')
                        .setRequired(false),
                ),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            throw new TitanBotError(
                'Giveaway blacklist command used outside guild',
                ErrorTypes.VALIDATION,
                'Lệnh này chỉ có thể sử dụng trong server.',
                { userId: interaction.user.id },
            );
        }

        const hasAdminRole = interaction.member?.roles?.cache?.has(GIVEAWAY_ADMIN_ROLE_ID);
        const hasManageGuild = interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);

        if (!hasAdminRole && !hasManageGuild) {
            await interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh này (cần quyền Quản lý máy chủ hoặc Role Giveaway Admin).',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            await handleAdd(interaction);
        } else if (subcommand === 'remove') {
            await handleRemove(interaction);
        } else if (subcommand === 'list') {
            await handleList(interaction);
        }
    },
};

function parseTargetUserId(interaction) {
    const targetUser = interaction.options.getUser('user');
    const rawUserId = interaction.options.getString('userid');
    let targetUserId = targetUser?.id || (rawUserId ? rawUserId.replace(/[<@!>]/g, '').trim() : null);

    if (!targetUserId) {
        return { error: '❌ Vui lòng chọn người dùng qua tuỳ chọn `user` hoặc nhập ID qua `userid`.' };
    }

    if (!/^\d{17,20}$/.test(targetUserId)) {
        return { error: '❌ User ID không hợp lệ. Vui lòng nhập đúng dãy 17-20 chữ số.' };
    }

    return { userId: targetUserId, user: targetUser };
}

async function handleAdd(interaction) {
    const { userId: targetUserId, error } = parseTargetUserId(interaction);
    if (error) {
        await interaction.reply({ content: error, flags: MessageFlags.Ephemeral });
        return;
    }

    const messageId = interaction.options.getString('messageid')?.trim() || null;
    const reason = interaction.options.getString('reason')?.trim() || 'Không có lý do cụ thể';

    if (messageId) {
        if (!/^\d+$/.test(messageId)) {
            await interaction.reply({
                content: '❌ Message ID không hợp lệ. Vui lòng chỉ nhập dãy số ID tin nhắn giveaway.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const lockKey = `giveaway:${messageId}`;
        await Mutex.runExclusive(lockKey, async () => {
            const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
            const giveaway = giveaways.find((g) => g.messageId === messageId);

            if (!giveaway) {
                await interaction.reply({
                    content: '❌ Không tìm thấy giveaway có Message ID này trong server.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (giveaway.ended || giveaway.isEnded || isGiveawayEnded(giveaway)) {
                await interaction.reply({
                    content: '❌ Giveaway này đã kết thúc, không thể áp dụng loại trừ quay thưởng.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            giveaway.blacklistedWinners = Array.isArray(giveaway.blacklistedWinners)
                ? giveaway.blacklistedWinners
                : [];

            if (giveaway.blacklistedWinners.includes(targetUserId)) {
                await interaction.reply({
                    content: `⚠️ Người dùng <@${targetUserId}> (\`${targetUserId}\`) đã có trong danh sách loại trừ của giveaway này rồi!`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            giveaway.blacklistedWinners.push(targetUserId);
            await saveGiveaway(interaction.client, interaction.guildId, giveaway);

            logger.info(`User ${targetUserId} added to giveaway ${messageId} excluded winners by ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor(0xF4A6C1)
                .setTitle('<a:chiikawag7:1541427343216738414> Đã thêm vào danh sách loại trừ giveaway')
                .setDescription(`Đã thiết lập loại trừ thành công cho <@${targetUserId}> trong giveaway chỉ định!`)
                .addFields(
                    {
                        name: '👤 Người bị loại trừ',
                        value: `<@${targetUserId}> (\`${targetUserId}\`)`,
                        inline: true,
                    },
                    {
                        name: '🎁 Phần thưởng giveaway',
                        value: String(giveaway.prize || 'Không xác định').slice(0, 1024),
                        inline: true,
                    },
                    {
                        name: '🆔 Giveaway Message ID',
                        value: `\`${messageId}\``,
                        inline: true,
                    },
                    {
                        name: '📝 Lý do',
                        value: reason,
                        inline: false,
                    },
                    {
                        name: '🔒 Cơ chế bí mật',
                        value: '• Người này **vẫn bấm nút Join giveaway bình thường**.\n• Tên của họ **vẫn nằm trong danh sách người tham gia**.\n• Nhưng khi hết giờ hoặc Admin end/reroll, bot **KHÔNG BAO GIỜ quay trúng họ**.',
                        inline: false,
                    },
                )
                .setFooter({
                    text: `Thực hiện bởi ${interaction.user.tag} • Bot Usagi`,
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        });
    } else {
        const lockKey = `giveaway:blacklist:${interaction.guildId}`;
        await Mutex.runExclusive(lockKey, async () => {
            const currentBlacklist = await getGuildGiveawayBlacklist(interaction.client, interaction.guildId);

            if (currentBlacklist[targetUserId]) {
                await interaction.reply({
                    content: `⚠️ Người dùng <@${targetUserId}> (\`${targetUserId}\`) đã có trong danh sách loại trừ toàn server rồi!`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await addGuildGiveawayBlacklist(interaction.client, interaction.guildId, targetUserId, {
                reason,
                addedBy: interaction.user.id,
                addedAt: new Date().toISOString(),
            });

            logger.info(`User ${targetUserId} added to server giveaway blacklist by ${interaction.user.tag} in guild ${interaction.guildId}`);

            const embed = new EmbedBuilder()
                .setColor(0xF4A6C1)
                .setTitle('<a:chiikawag7:1541427343216738414> Đã thêm vào danh sách loại trừ TOÀN SERVER')
                .setDescription(`Đã thiết lập loại trừ thành công cho <@${targetUserId}> trên **tất cả giveaway** của server!`)
                .addFields(
                    {
                        name: '👤 Người bị loại trừ',
                        value: `<@${targetUserId}> (\`${targetUserId}\`)`,
                        inline: true,
                    },
                    {
                        name: '🌐 Phạm vi áp dụng',
                        value: '**TOÀN BỘ GIVEAWAY TRONG SERVER**',
                        inline: true,
                    },
                    {
                        name: '📝 Lý do',
                        value: reason,
                        inline: false,
                    },
                    {
                        name: '🔒 Cơ chế bí mật',
                        value: '• Người này **vẫn bấm nút Join mọi giveaway bình thường**.\n• Tên của họ **vẫn tăng sĩ số và xuất hiện trong danh sách tham gia**.\n• Khi hết giờ hoặc Admin end/reroll bất kỳ giveaway nào, bot **KHÔNG BAO GIỜ quay trúng họ**.',
                        inline: false,
                    },
                )
                .setFooter({
                    text: `Thực hiện bởi ${interaction.user.tag} • Bot Usagi`,
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        });
    }
}

async function handleRemove(interaction) {
    const { userId: targetUserId, error } = parseTargetUserId(interaction);
    if (error) {
        await interaction.reply({ content: error, flags: MessageFlags.Ephemeral });
        return;
    }

    const messageId = interaction.options.getString('messageid')?.trim() || null;

    if (messageId) {
        if (!/^\d+$/.test(messageId)) {
            await interaction.reply({
                content: '❌ Message ID không hợp lệ. Vui lòng chỉ nhập dãy số ID tin nhắn giveaway.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const lockKey = `giveaway:${messageId}`;
        await Mutex.runExclusive(lockKey, async () => {
            const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
            const giveaway = giveaways.find((g) => g.messageId === messageId);

            if (!giveaway) {
                await interaction.reply({
                    content: '❌ Không tìm thấy giveaway có Message ID này trong server.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            giveaway.blacklistedWinners = Array.isArray(giveaway.blacklistedWinners)
                ? giveaway.blacklistedWinners
                : [];

            if (!giveaway.blacklistedWinners.includes(targetUserId)) {
                await interaction.reply({
                    content: `⚠️ Người dùng <@${targetUserId}> (\`${targetUserId}\`) không có trong danh sách loại trừ của giveaway này.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            giveaway.blacklistedWinners = giveaway.blacklistedWinners.filter((id) => id !== targetUserId);
            await saveGiveaway(interaction.client, interaction.guildId, giveaway);

            logger.info(`User ${targetUserId} removed from giveaway ${messageId} excluded winners by ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor(0xF4A6C1)
                .setTitle('✨ Đã gỡ khỏi danh sách loại trừ giveaway')
                .setDescription(`Đã xoá <@${targetUserId}> khỏi danh sách loại trừ của giveaway \`${messageId}\`!`)
                .addFields(
                    {
                        name: '👤 Người dùng',
                        value: `<@${targetUserId}> (\`${targetUserId}\`)`,
                        inline: true,
                    },
                    {
                        name: '🆔 Giveaway Message ID',
                        value: `\`${messageId}\``,
                        inline: true,
                    },
                    {
                        name: 'ℹ️ Trạng thái mới',
                        value: 'Người này hiện đã có thể trúng thưởng như bình thường khi quay số.',
                        inline: false,
                    },
                )
                .setFooter({
                    text: `Thực hiện bởi ${interaction.user.tag} • Bot Usagi`,
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        });
    } else {
        const lockKey = `giveaway:blacklist:${interaction.guildId}`;
        await Mutex.runExclusive(lockKey, async () => {
            const currentBlacklist = await getGuildGiveawayBlacklist(interaction.client, interaction.guildId);

            if (!currentBlacklist[targetUserId]) {
                await interaction.reply({
                    content: `⚠️ Người dùng <@${targetUserId}> (\`${targetUserId}\`) không nằm trong danh sách loại trừ toàn server.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await removeGuildGiveawayBlacklist(interaction.client, interaction.guildId, targetUserId);

            logger.info(`User ${targetUserId} removed from server giveaway blacklist by ${interaction.user.tag} in guild ${interaction.guildId}`);

            const embed = new EmbedBuilder()
                .setColor(0xF4A6C1)
                .setTitle('✨ Đã gỡ khỏi danh sách loại trừ TOÀN SERVER')
                .setDescription(`Đã xoá <@${targetUserId}> khỏi danh sách loại trừ toàn server!`)
                .addFields(
                    {
                        name: '👤 Người dùng',
                        value: `<@${targetUserId}> (\`${targetUserId}\`)`,
                        inline: true,
                    },
                    {
                        name: '🌐 Phạm vi',
                        value: 'Toàn bộ máy chủ',
                        inline: true,
                    },
                    {
                        name: 'ℹ️ Trạng thái mới',
                        value: 'Người này hiện đã có thể trúng thưởng trong tất cả các giveaway bình thường.',
                        inline: false,
                    },
                )
                .setFooter({
                    text: `Thực hiện bởi ${interaction.user.tag} • Bot Usagi`,
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        });
    }
}

async function handleList(interaction) {
    const messageId = interaction.options.getString('messageid')?.trim() || null;

    if (messageId) {
        if (!/^\d+$/.test(messageId)) {
            await interaction.reply({
                content: '❌ Message ID không hợp lệ. Vui lòng chỉ nhập dãy số ID tin nhắn giveaway.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
        const giveaway = giveaways.find((g) => g.messageId === messageId);

        if (!giveaway) {
            await interaction.reply({
                content: '❌ Không tìm thấy giveaway có Message ID này trong server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const giveawayExcluded = Array.isArray(giveaway.blacklistedWinners) ? giveaway.blacklistedWinners : [];
        const serverBlacklist = await getGuildGiveawayBlacklist(interaction.client, interaction.guildId);
        const serverExcludedIds = Object.keys(serverBlacklist || {});

        const embed = new EmbedBuilder()
            .setColor(0xF4A6C1)
            .setTitle(`📋 Danh sách loại trừ cho Giveaway: ${giveaway.prize || messageId}`)
            .setDescription(`**Message ID:** \`${messageId}\`\n**Trạng thái:** ${giveaway.ended || giveaway.isEnded ? 'Đã kết thúc' : 'Đang hoạt động'}`)
            .addFields(
                {
                    name: `🎯 Loại trừ riêng cho giveaway này (${giveawayExcluded.length})`,
                    value: giveawayExcluded.length > 0
                        ? giveawayExcluded.map((id) => `• <@${id}> (\`${id}\`)`).join('\n')
                        : 'Không có ai bị loại trừ riêng cho giveaway này.',
                    inline: false,
                },
                {
                    name: `🌐 Loại trừ toàn server (${serverExcludedIds.length})`,
                    value: serverExcludedIds.length > 0
                        ? serverExcludedIds.map((id) => `• <@${id}> (\`${id}\`)${serverBlacklist[id]?.reason ? ` - Lý do: ${serverBlacklist[id].reason}` : ''}`).join('\n')
                        : 'Không có ai trong danh sách toàn server.',
                    inline: false,
                },
            )
            .setFooter({
                text: 'Những người trong danh sách trên vẫn tham gia được nhưng bot sẽ không quay trúng • Bot Usagi',
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    } else {
        const serverBlacklist = await getGuildGiveawayBlacklist(interaction.client, interaction.guildId);
        const entries = Object.values(serverBlacklist || {});

        if (entries.length === 0) {
            await interaction.reply({
                content: 'ℹ️ Hiện tại không có người dùng nào nằm trong danh sách loại trừ giveaway toàn server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const lines = entries.map((entry, index) => {
            const addedTimestamp = entry.addedAt ? Math.floor(new Date(entry.addedAt).getTime() / 1000) : null;
            const timeStr = addedTimestamp ? `<t:${addedTimestamp}:R>` : 'Không rõ lúc';
            const adminStr = entry.addedBy ? `<@${entry.addedBy}>` : 'Admin';
            return `**${index + 1}.** <@${entry.userId}> (\`${entry.userId}\`)\n   • **Lý do:** ${entry.reason || 'Không có lý do'}\n   • **Thêm bởi:** ${adminStr} (${timeStr})`;
        });

        const embed = new EmbedBuilder()
            .setColor(0xF4A6C1)
            .setTitle(`📋 Danh sách loại trừ giveaway TOÀN SERVER (${entries.length})`)
            .setDescription(lines.join('\n\n').slice(0, 4000))
            .setFooter({
                text: 'Họ vẫn bấm tham gia được mọi giveaway nhưng bot sẽ không bao giờ quay trúng • Bot Usagi',
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
}
