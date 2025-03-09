import { Client, Events } from 'discord.js';
import { checkExpiredSuspensions } from '../database/mongo';
import { processSuspensionEvents } from '../controllers/suspensionDueHandler';
import { processUnsuspensionEvents } from '../controllers/unsuspensionDueHandler';

export const name = Events.ClientReady;
export const once = true;

export const execute = async (client: Client) => {
  console.log(`Ready! Logged in as ${client.user?.tag}`);

  // Run checkExpiredSuspensions() every 5 minutes 25 seconds.
  setInterval(() => {
    checkExpiredSuspensions();
  }, 325000);

  // Run processSuspensionEvents() every 17 minutes 10 seconds.
  setInterval(() => {
    processSuspensionEvents(client);
  }, 1030000);

  // Run processUnsuspensionEvents() every 2 minutes 15 seconds.
  setInterval(() => {
    processUnsuspensionEvents(client);
  }, 135000);
};
