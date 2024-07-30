require('dotenv').config()
const { Client } = require('pg')
const TelegramBot = require('node-telegram-bot-api')
const { gameOptions, againOptions } = require('./options')

const client = new Client({
  connectionString: process.env.DATABASE_URL,
})
client.connect()

const token = process.env.TELEGRAM_BOT_TOKEN

const bot = new TelegramBot(token, { polling: true })

const chats = {}

let startExecuted = false
let topicInStack = false

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
    { command: '/info', description: 'Получить информацию о пользователе' },
    { command: '/game', description: 'Игра угадай цифру' },
    { command: '/addtopic', description: 'Добавить тему для изучения' },
    { command: 'seetopics', description: 'Посмотреть все темы' },
  ])

  bot.on('message', async (msg) => {
    const text = msg.text
    const chatId = msg.chat.id

    if (text === '/start' && !startExecuted) {
      startExecuted = true
      await bot.sendSticker(
        chatId,
        'https://sl.combot.org/cryptonotes/webp/0xf09f9690.webp'
      )
      return bot.sendMessage(
        chatId,
        'Можешь посмотреть список доступных команд в меню ниже'
      )
    } else if (text === '/start' && startExecuted) {
      return bot.sendMessage(
        chatId,
        'Мы уже здоровались, доступные команды написаны в меню ниже'
      )
    }

    if (text === '/info') {
      return bot.sendMessage(chatId, `Тебя зовут ${msg.from.first_name}`)
    }

    if (text === '/game') {
      return startGame(chatId)
    }

    if (text === '/addtopic') {
      topicInStack = true
      return bot.sendMessage(chatId, 'Напишите тему для добавления в список')
    }

    if (text === '/seetopics') {
      const res = await client.query('SELECT * FROM topics ORDER BY created_at')
      const topics = res.rows
        .map(
          (row, index) =>
            `${index + 1}. ${row.topic} (добавлено: ${row.created_at})`
        )
        .join('\n')
      return bot.sendMessage(chatId, `Темы:\n${topics}`)
    }

    if (topicInStack) {
      topicInStack = false
      await client.query('INSERT INTO topics (topic) VALUES ($1)', [text])
      return bot.sendMessage(chatId, 'Тема успешно добавлена в список!')
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
