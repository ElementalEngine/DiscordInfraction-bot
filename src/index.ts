import { connectDB } from './database/mongo';
import discord from './discord/index';
import { app } from './server';
import { config } from './config';

discord.login(config.discord.token);

connectDB();

app.listen(
  config.port,
  ['127.0.0.1', 'localhost'].includes(config.host) ? config.host : '0.0.0.0',
  () => {
    console.log(`Server running at http://${config.host}:${config.port}/`);
  }
);
