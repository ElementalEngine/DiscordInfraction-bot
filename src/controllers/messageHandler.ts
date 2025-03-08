import { config } from '../config';

/**
 * Builds a suspension notice message for a DM using command parameters.
 */
export function buildSuspensionNotice(
  infractionType: string,
  tier: number,
  endDate: Date,
  reason?: string,
  isBanTier: boolean = false
): string {
  let message = `**Suspension Notice:** You have been suspended for a **${infractionType}** infraction.\n` +
                `Your **${infractionType}** tier is now **Tier ${tier}**.\n` +
                `Suspension ends on: **${endDate.toLocaleString()}**.\n` +
                (reason ? `Reason: **${reason}**\n` : '');
  if (isBanTier) {
    message += `You have reached **${infractionType}** tier **${tier}**, You now have **24 hours** to appeal your permaban.`;
  } else {
    message += `Please review our guidelines.`;
  }
  return message;
}

/**
 * Builds a suspension message for posting in a channel using command parameters.
 */
export function buildSuspensionChannelMessage(
  userId: string,
  infractionType: string,
  tier: number,
  endDate: Date,
  reason?: string,
  isBanTier: boolean = false
): string {
  let message = `<@${userId}> has been suspended for a **${infractionType}** infraction.\n` +
                `New **${infractionType}** tier: **Tier ${tier}**\n` +
                `Suspension ends on: **${endDate.toLocaleString()}**\n` +
                (reason ? `Reason: **${reason}**\n` : '');
  if (isBanTier) {
    message += `<@&${config.discord.roles.moderator}> - Target user is due to be banned via Wick.`;
  } else {
    message += `Please review our guidelines.`;
  }
  return message;
}
