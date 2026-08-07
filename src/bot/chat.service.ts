import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat, ChatDocument } from '../schemas/chat.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
  ) {}

  async add(chatId: number) {
    await this.chatModel.updateOne({ chatId }, { chatId }, { upsert: true });
  }

  async remove(chatId: number) {
    await this.chatModel.deleteOne({ chatId });
  }

  async getAll(): Promise<number[]> {
    const chats = await this.chatModel.find().lean();
    return chats.map((c) => c.chatId);
  }
}
