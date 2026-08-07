FROM node:23-slim

WORKDIR /home/kolytics-message-bot

COPY package.json . 
COPY pnpm-lock.yaml . 
COPY . .

RUN npm install -g pnpm pm2
RUN pnpm install
RUN pnpm build

EXPOSE 3012