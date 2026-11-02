// ticketPermissions.js

import { PermissionFlagsBits } from 'discord.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import { getTicketData } from '../database.js';

export async function getTicketPermissionContext({ client, interaction }) {
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;

  const [config, ticketData] = await Promise.all([
    getGuildConfig(client, guildId),
    getTicketData(guildId, channelId)
  ]);

  const hasManageChannels = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
  const staffRoleId = config.ticketStaffRoleId || null;
  const SUPPORT_ROLE_ID = '1545295139390619768';
  const hasTicketStaffRole = Boolean(
    (staffRoleId && interaction.member.roles?.cache?.has(staffRoleId)) ||
    interaction.member.roles?.cache?.has(SUPPORT_ROLE_ID) ||
    (Array.isArray(interaction.member.roles) && (interaction.member.roles.includes(staffRoleId) || interaction.member.roles.includes(SUPPORT_ROLE_ID)))
  );
  const isTicketCreator = Boolean(
    ticketData?.userId && String(ticketData.userId) === String(interaction.user.id),
  );

  return {
    config,
    ticketData,
    hasManageChannels,
    hasTicketStaffRole,
    isTicketCreator,
    canManageTicket: hasManageChannels || hasTicketStaffRole,
    canCloseTicket: hasManageChannels || hasTicketStaffRole || isTicketCreator,
  };
}