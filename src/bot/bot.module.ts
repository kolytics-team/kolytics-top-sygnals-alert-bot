import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { BotService } from './bot.service';
import { AmqpProvider } from '../providers/amqp.provider';
import { ChatService } from './chat.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Chat, ChatSchema } from '../schemas/chat.schema';
import { KolStatsService } from './kol-stats.service';
import { LeaderboardScheduler } from '../cron/leaderboard.cron';
import { KolCall, KolCallSchema } from '../schemas/kol-call.schema';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({ token: cfg.get('BOT_TOKEN') }),
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: KolCall.name, schema: KolCallSchema },
    ]),
  ],
  providers: [
    BotService,
    ChatService,
    AmqpProvider,
    KolStatsService,
    LeaderboardScheduler,
  ],
})
export class BotModule {}
