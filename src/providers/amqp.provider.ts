import { Provider } from '@nestjs/common';
import { connect, ChannelWrapper } from 'amqp-connection-manager';

export const AMQP_SERVICE = 'AMQP_SERVICE';

export const AmqpProvider: Provider = {
  provide: AMQP_SERVICE,
  useFactory: (): ChannelWrapper => {
    const url = process.env.RABBITMQ_URL ?? 'amqp://localhost';
    const connection = connect([url]);

    connection.on('connect', () => console.log('🟢 AMQP connected'));
    connection.on('disconnect', (e) =>
      console.error('🔴 AMQP disconnected', e?.err?.message),
    );

    const channel = connection.createChannel({
      json: true,
      setup: (ch) =>
        ch
          .assertExchange('signals', 'direct', { durable: true })
          .then(() => ch.assertQueue('token-x-queue', { durable: true }))
          .then(() => ch.bindQueue('token-x-queue', 'signals', 'token-x')),
    });

    channel.on('connect', () => console.log('✅ Channel connected'));
    channel.on('error', (err) =>
      console.error('❌ Channel error', err.message),
    );

    return channel;
  },
};
