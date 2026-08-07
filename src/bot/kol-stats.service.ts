import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KolCall, KolCallDocument } from '../schemas/kol-call.schema';

@Injectable()
export class KolStatsService {
  private readonly logger = new Logger(KolStatsService.name);

  constructor(
    @InjectModel(KolCall.name)
    private readonly kolModel: Model<KolCallDocument>,
  ) {}

  async record(raw: string): Promise<boolean> {
    const m1 = /hit\s+(\d+(?:\.\d+)?)x/i.exec(raw);

    const m2 = /Market Cap:\s*\$([\d.,]+).*?→\s*\$([\d.,]+)/i.exec(raw);

    let x: number | null = null;
    if (m1) {
      x = +m1[1];
    } else if (m2) {
      const from = +m2[1].replace(/[^\d.]/g, '');
      const to = +m2[2].replace(/[^\d.]/g, '');
      if (from > 0) x = +(to / from).toFixed(4);
    }

    if (!x) return false;

    const twitterAt = /@([\w\d_]+)/.exec(raw)?.[0];
    const twitterUrl = /\bhttps?:\/\/(?:www\.)?twitter\.com\/([^/\s)]+)/i.exec(
      raw,
    )?.[1];
    const telegramUrl = /\bhttps?:\/\/t\.me\/([^/\s)]+)/i.exec(raw)?.[1];

    const kol = twitterAt
      ? twitterAt
      : twitterUrl
        ? `@${twitterUrl}`
        : telegramUrl || 'Unknown';

    await this.kolModel.create({ kol, x, raw });
    return true;
  }

  async getDailyLeaderboard(day = new Date()) {
    const start = new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const end = new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    this.logger.debug(
      `Getting leaderboard for period: ${start.toISOString()} – ${end.toISOString()}`,
    );

    const result = await this.kolModel.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: '$kol',
          sumX: { $sum: '$x' },
          calls: { $sum: 1 },
          avgX: { $avg: '$x' },
        },
      },
      { $sort: { sumX: -1 } },
      { $limit: 10 },
    ]);

    return result as {
      _id: string;
      sumX: number;
      calls: number;
      avgX: number;
    }[];
  }
}

