# Kolytics Message Bot

Telegram bot that broadcasts KOL "token X" signals to subscribed chats and publishes a daily leaderboard.

Built with NestJS + Telegraf. The bot:

- Consumes messages from the RabbitMQ queue `token-x-queue` (exchange `signals`, routing key `token-x`).
- Sends each signal to every chat where the bot is present, as an animation from `assets/kolytics_gif_<N>x.mp4` picked by the multiplier found in the message text. Sending is rate limited globally and per chat.
- Tracks chats automatically: joining a group/channel subscribes it, leaving or being kicked unsubscribes it.
- Parses each signal (`hit Nx` or a `Market Cap: $A → $B` pair) into a KOL call record in MongoDB.
- At 00:05 UTC daily posts the top-10 KOL leaderboard for the previous day (total gains, number of calls, average multiplier).

## Requirements

- Node.js 20+ (Docker image uses Node 23)
- pnpm
- MongoDB
- RabbitMQ

## Configuration

Copy `.env.example` to `.env` and fill in the values:

| Variable       | Description                                              |
| -------------- | -------------------------------------------------------- |
| `NODE_ENV`     | `development` / `production`                              |
| `BOT_TOKEN`    | Telegram bot token from @BotFather                        |
| `MONGODB_URI`  | MongoDB connection string                                 |
| `RABBITMQ_URL` | AMQP connection string (defaults to `amqp://localhost`)   |

## Running locally

```bash
pnpm install
pnpm dev      # watch mode
```

Production build:

```bash
pnpm build
pnpm start    # runs dist/main.js
```

The HTTP server listens on port 3000.

## Running with Docker

`docker-compose.production.yml` contains `__PLACEHOLDER__` values for the environment variables — substitute them (e.g. from CI secrets) before starting:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

## Other scripts

```bash
pnpm lint     # eslint --fix
pnpm test     # jest
```
