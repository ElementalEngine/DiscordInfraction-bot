import express from 'express';
import cors from 'cors';
import { config } from './config';

export const app = express();

app.use(express.json());
app.use(cors({ origin: config.cors }));

app.get('/', (req, res) => {
  res.send('Discord Ban Bot API is running.');
});
