import { config } from '../config';

export function buildSuspensionNotice(
  infractionType: string,
  tier: number,
  endDate: Date,
  reason?: string,
  isBanTier: boolean = false
): string {
  const formattedEnd = endDate.toLocaleString();
  let message = `Suspension Notice: You have been suspended for a **${infractionType}** infraction.\n` +
                `Your ${infractionType} tier is now **Tier ${tier}**.\n` +
                `Suspension ends on: **${formattedEnd}**.\n` +
                `Reason: **${reason || 'No reason provided'}**.\n`;
  message += isBanTier
    ? `You have reached tier **${tier}**. You now have **24 hours** to appeal your permaban.`
    : `Please review our guidelines.`;
  return message;
}

export function buildSuspensionChannelMessage(
  userId: string,
  infractionType: string,
  tier: number,
  endDate: Date,
  reason?: string,
  isBanTier: boolean = false
): string {
  const formattedEnd = endDate.toLocaleString();
  let message = `<@${userId}> has been suspended for a **${infractionType}** infraction.\n` +
                `New ${infractionType} tier: **Tier ${tier}**.\n` +
                `Suspension ends on: **${formattedEnd}**.\n` +
                `Reason: **${reason || 'No reason provided'}**.\n`;
  message += isBanTier
    ? `<@&${config.discord.roles.moderator}> - Target user is due to be banned via Wick.`
    : `Please review our guidelines.`;
  return message;
}
