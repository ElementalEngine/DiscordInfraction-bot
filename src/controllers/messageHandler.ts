import { config } from '../config';

const durations: { [key: string]: number[] } = {
  quit: [1, 3, 7, 14, 30],
  minor: [0, 1, 2, 4, 7, 14],
  moderate: [1, 4, 7, 14, 30],
  major: [7, 14, 30],
  extreme: [30],
};

export function buildSuspensionNotice(
  infractionType: string,
  tier: number,
  endDate: Date,
  reason?: string,
  isBanTier: boolean = false
): string {
  const formattedEnd = `${endDate.toLocaleDateString()}, ${endDate.toLocaleTimeString()}`;
  const typeKey = infractionType.toLowerCase();
  const daysArray = durations[typeKey] || [];
  const suspensionDays = daysArray[tier - 1] || 0;
  
  const resultLine = isBanTier 
    ? "cpl server ban." 
    : (suspensionDays === 1 ? `**${suspensionDays}** day suspension.` : `**${suspensionDays}** days suspension.`);
  
  let message = `Suspension Notice:\n` +
                `Infraction: **[ TIER ${tier} ${infractionType.toUpperCase()} ]**\n` +
                `Result: ${resultLine}\n` +
                `Suspension ends on: **${formattedEnd}**\n` +
                `Reason: ${reason || 'No reason provided'}`;
                
  if (isBanTier) {
    message += `\nYou have reached tier **${tier}**. You now have **24 hours** to appeal your permaban.`;
  }
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
  const formattedEnd = `${endDate.toLocaleDateString()}, ${endDate.toLocaleTimeString()}`;
  const typeKey = infractionType.toLowerCase();
  const daysArray = durations[typeKey] || [];
  const suspensionDays = daysArray[tier - 1] || 0;
  
  const resultLine = isBanTier 
    ? "User banned from server." 
    : (suspensionDays === 1 ? `**${suspensionDays}** day suspension.` : `**${suspensionDays}** days suspension.`);
  
  let message = `Suspension Notice:\n` +
                `Member: <@${userId}>\n` +
                `Infraction: **[ TIER ${tier} ${infractionType.toUpperCase()} ]**\n` +
                `Result: ${resultLine}\n` +
                `Suspension ends on: **${formattedEnd}**\n` +
                `Reason: ${reason || 'No reason provided'}`;
                
  if (isBanTier) {
    message += `\n<@&${config.discord.roles.moderator}> - Target user is due to be banned via Wick.`;
  }
  return message;
}