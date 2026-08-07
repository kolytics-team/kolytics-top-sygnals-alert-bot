import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ChatService } from '../bot/chat.service';
import { KolStatsService } from '../bot/kol-stats.service';
import { BotService } from '../bot/bot.service';

@Injectable()
export class LeaderboardScheduler {
  constructor(
    private readonly kolStats: KolStatsService,
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => BotService))
    private readonly bot: BotService,
  ) {}

  @Cron('5 0 * * *', { timeZone: 'UTC' })
  async publish() {
    const todayMidnight = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
      ),
    );

    const targetDay = new Date(todayMidnight.getTime() - 86_400_000);

    const leaderboard = await this.kolStats.getDailyLeaderboard(targetDay);
    if (!leaderboard.length) return;

    const medals = ['🥇', '🥈', '🥉'];

    const body = leaderboard
      .map((r, i) => {
        const place = medals[i] ?? `#${i + 1}`;
        const username = r._id;

        const isTwitter = username.startsWith('@');
        const link = isTwitter
          ? `https://twitter.com/${username.slice(1)}`
          : `https://t.me/${username}`;

        const label = isTwitter ? username : `@${username}`;

        return (
          `${place} <b><a href="${link}">${label}</a></b>\n` +
          `—————————\n` +
          `💹 - Total Gains: ${r.sumX.toFixed(1)}X\n` +
          `🤙🏻 - Calls: ${r.calls}\n` +
          `🥁 - Average: ${r.avgX.toFixed(1)}X`
        );
      })
      .join('\n\n');

    const dateTag = targetDay.toISOString().slice(0, 10);
   const msg =
      `🏆 <b>Daily KOL Leaderboard</b> — ${dateTag} (UTC)\n\n` +
      `${body}\n\n` +
      `Keep grinding and see you tomorrow!`;

    const chats = await this.chatService.getAll();
    await Promise.all(chats.map((id) => this.bot.safeSend(id, msg)));
  }
}
