import * as dotenv from "dotenv";
import { Telegraf } from "telegraf";

dotenv.config();

export const telegraf = new Telegraf(process.env?.BOT_TOKEN as string);
