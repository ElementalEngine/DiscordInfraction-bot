import { config as dotenvConfig } from 'dotenv';
import path from 'node:path';

dotenvConfig({
  path: path.resolve('./.env'),
});

export const config = {
  oauth: `https://discord.com/api/oauth2/authorize?client_id=${process.env.BOT_CLIENT_ID ?? ''}&redirect_uri=http%3A%2F%2F${process.env.HOST ?? 'localhost'}:${process.env.PORT ?? 3000}&response_type=code&scope=identify%20connections&state=`,
  cors: process.env.CORS ?? '*',
  discord: {
    clientId: process.env.BOT_CLIENT_ID ?? '',
    token: process.env.BOT_TOKEN ?? '',
    clientSecret: process.env.BOT_CLIENT_SECRET ?? '',
    guildId: process.env.DISCORD_GUILD_ID ?? '',
    channels: {
      suspendedChannel: process.env.CHANNEL_SUSPENDED_ID ?? '',
    },
    roles: {
      moderator: process.env.ROLE_MODERATOR ?? '',
      cplBackend: process.env.ROLE_BACKEND ?? '',
      civ6Rank: process.env.ROLE_CIV6 ?? '',
      civ7Rank: process.env.ROLE_CIV7 ?? '',
      civ6Novice: process.env.ROLE_CIV6_NOVICE ?? '',
      cplTournament: process.env.ROLE_CPL_TOURNAMENT ?? '',
      cplCloud: process.env.ROLE_CPL_CLOUD ?? '',
      suspended: process.env.ROLE_SUSPENDED ?? '',
    },
  },
  host: process.env.HOST ?? 'localhost',
  port: Number(process.env.PORT ?? 3000),
  mongoDb: process.env.MONGO_URL ?? '',
};
