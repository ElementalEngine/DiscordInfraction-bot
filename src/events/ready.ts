import { Client, Events } from 'discord.js';
import { checkExpiredSuspensions } from '../database/mongo';
import { processSuspensionEvents } from '../controllers/suspensionDueHandler';
import { processUnsuspensionEvents } from '../controllers/unsuspensionDueHandler';

export const name = Events.ClientReady;
export const once = true;

export const execute = async (client: Client) => {
  console.log(`Ready! Logged in as ${client.user?.tag}`);
  
  const cycleDelay = 10 * 60 * 1000; // 10 minutes in milliseconds

  // An asynchronous loop that runs the tasks sequentially.
  const runCycle = async (): Promise<void> => {
    console.log('[Cycle] Starting cycle of background tasks.');
    await checkExpiredSuspensions();
    await processSuspensionEvents(client);
    await processUnsuspensionEvents(client);
    console.log('[Cycle] Background tasks cycle complete.');
    setTimeout(runCycle, cycleDelay);
  };

  runCycle();
};
