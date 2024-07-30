require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const { gameOptions, againOptions } = require('./options')
const token = process.env.TELEGRAM_BOT_TOKEN

const bot = new TelegramBot(token, { polling: true })

const chats = {}

const startGame = async (chatId) => {
  await bot.sendMessage(
    chatId,
    'Сейчас я загадаю цифру от 0 до 9, а ты попробуй ее угадать'
  )
  const randomNumber = Math.floor(Math.random() * 10)
  chats[chatId] = randomNumber
  await bot.sendMessage(chatId, 'Отгадывай', gameOptions)
}

const start = () => {
  bot.setMyCommands([
    { command: '/start', description: 'Начальное приветствие' },
    { command: '/info', description: 'Получить информацию о пользователе' },
    { command: '/game', description: 'Игра угадай цифру' },
  ])

  bot.on('message', async (msg) => {
    const text = msg.text
    const chatId = msg.chat.id

    if (text === '/start') {
      await bot.sendSticker(
        chatId,
        'https://sl.combot.org/cryptonotes/webp/0xf09f9690.webp'
      )
      return bot.sendMessage(chatId, `Привет.`)
    }

    if (text === '/info') {
      return bot.sendMessage(chatId, `Тебя зовут ${msg.from.first_name}`)
    }

    if (text === '/game') {
      return startGame(chatId)
    }

    return bot.sendMessage(chatId, 'Я тебя не понимаю, напиши команду')
  })

  bot.on('callback_query', (msg) => {
    const data = msg.data
    const chatId = msg.message.chat.id
    if (data === '/again') {
      return startGame(chatId)
    }
    if (parseInt(data) === chats[chatId]) {
      return bot.sendMessage(
        chatId,
        `Поздравляю, ты отгадал, это была цифра ${chats[chatId]}`,
        againOptions
      )
    } else {
      return bot.sendMessage(
        chatId,
        `К сожалению ты не угадал, бот загадывал цифру ${chats[chatId]}`,
        againOptions
      )
    }
  })
}

start()
