import { config } from '../config';

// Suspension durations (in days) per tier for each infraction type.
const durations: { [key: string]: number[] } = {
  quit: [1, 3, 7, 14, 30],
  minor: [0, 1, 2, 4, 7, 14],
  moderate: [1, 4, 7, 14, 30],
  major: [7, 14, 30],
  extreme: [30],
};

// Builds a suspension notice message for direct messages.
export function buildSuspensionNotice(
  infractionType: string,
  tier: number,
  endDate: Date,
  reason?: string,
  isBanTier: boolean = false
): string {
  // Format the end date as "DD/MM/YYYY, HH:MM:SS"
  const formattedEnd = `${endDate.toLocaleDateString()}, ${endDate.toLocaleTimeString()}`;
  // Determine the number of suspension days from the lookup.
  const typeKey = infractionType.toLowerCase();
  const daysArray = durations[typeKey] || [];
  const suspensionDays = daysArray[tier - 1] || 0;
  // Compute the result line based on ban tier.
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

// Builds a suspension message for channel notifications.
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