import {
  Message,
  CallbackQuery,
  InlineKeyboardButton,
} from 'telegraf/typings/core/types/typegram';

// telegraf typings differ across versions; provide broad aliases for messaging options
export type SendMessageOptions = any;
export type EditMessageTextOptions = any;

export { Message, CallbackQuery, InlineKeyboardButton };
