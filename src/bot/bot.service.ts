import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { ChannelWrapper } from 'amqp-connection-manager';
import Bottleneck from 'bottleneck';
import * as path from 'path';
import * as fs from 'node:fs';

import { AMQP_SERVICE } from '../providers/amqp.provider';
import { ChatService } from './chat.service';
import { KolStatsService } from './kol-stats.service';

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private readonly QUEUE = 'token-x-queue';

  private readonly globalLimiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 40,
  });

  private readonly chatLimiter = new Bottleneck.Group({
    maxConcurrent: 1,
    minTime: 0,
    reservoir: 20,
    reservoirRefreshInterval: 60_000,
    reservoirRefreshAmount: 20,
  });

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly chatService: ChatService,
    @Inject(AMQP_SERVICE) private readonly amqp: ChannelWrapper,
    private readonly kolStats: KolStatsService,
  ) {}

  public async safeSend(chatId: number, text: string): Promise<void> {
    while (true) {
      try {
        const source = this.getGifSource(text);
        const caption = text.replace('staging-', '');

        await this.bot.telegram.sendAnimation(
          chatId,
          { source },
          {
            caption,
            parse_mode: 'HTML',
          }
        );
        return;
      } catch (err: any) {
        const retry = err?.response?.parameters?.retry_after;
        if (retry === undefined) throw err;

        const wait = (retry + 1) * 1_000;
        this.logger.warn(
          `Chat ${chatId}: ${err.response.error_code} — повтор через ${retry}s`,
        );
        await (await import('delay')).default(wait);
      }
    }
  }

  getGifSource(text: string) {
    const multiplierMatch = text.match(/(\d+)x/i);
    if (!multiplierMatch) {
      throw new Error('Множитель не найден в тексте');
    }

    let multiplier = Number(multiplierMatch[1]);

    const allMulti = [2, 3, 5, 10, 20, 30, 40, 50, 100];
    const lastPossibleMultiplier = allMulti[allMulti.length - 1];

    if (!allMulti.includes(Number(multiplier))) {
      if (multiplier > lastPossibleMultiplier) {
        multiplier = lastPossibleMultiplier;
      } else {
        multiplier = allMulti
        .filter(m => m - multiplier >= 0)
        .sort((a, b) => a - b)[0];
      }
    }

    const gifPath = path.join(process.cwd(), 'assets', `kolytics_gif_${multiplier}x.mp4`);

    if (!fs.existsSync(gifPath)) {
      throw new Error(`Файл kolytics_gif_${multiplier}x.mp4 не найден в папке assets`);
    }

    return fs.createReadStream(gifPath);
  }

  async onModuleInit() {
    this.bot.on('my_chat_member', async (ctx) => {
      const up = ctx.update.my_chat_member!;
      if (up.new_chat_member.user.id !== ctx.botInfo.id) return;

      const chatId = Number(ctx.chat.id);
      const type = ctx.chat.type;

      if (['member', 'administrator'].includes(up.new_chat_member.status)) {
        await this.chatService.add(chatId);
        await ctx.reply('👋');
        this.logger.log(`➕ Added to ${type} ${chatId}`);
      }

      if (['left', 'kicked'].includes(up.new_chat_member.status)) {
        await this.chatService.remove(chatId);
        this.logger.log(`➖ Removed from ${type} ${chatId}`);
      }
    });

    await this.amqp.addSetup(async (ch) => {
      await ch.assertQueue(this.QUEUE, { durable: true });
      await ch.bindQueue(this.QUEUE, 'signals', 'token-x');
      await ch.prefetch(5);
    });
    this.logger.log(`✅ Queue "${this.QUEUE}" bound to "signals"`);

    await this.amqp.consume(this.QUEUE, async (msg) => {
      if (!msg) return;
      this.logger.log('📨 Message received');

      let payload: { text: string };
      try {
        payload = JSON.parse(msg.content.toString());
      } catch (e) {
        this.logger.error(`Bad JSON: ${(e as Error).message}`);
        return this.amqp.nack(msg, false, false);
      }

      await this.kolStats.record(payload.text);

      const chats = await this.chatService.getAll();
      const jobs = chats.map((chatId) =>
        this.chatLimiter
          .key(String(chatId))
          .schedule(() =>
            this.globalLimiter.schedule(() =>
              this.safeSend(chatId, payload.text),
            ),
          ),
      );

      const results = await Promise.allSettled(jobs);
      const hasErrors = results.some((r) => r.status === 'rejected');

      if (hasErrors) {
        results
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .forEach((r) => this.logger.warn((r.reason as Error).message));

        this.amqp.nack(msg, false, true);
      } else {
        this.amqp.ack(msg);
      }
    });

    this.logger.log(`🚀 Consumer started on queue "${this.QUEUE}"`);
  }
}
