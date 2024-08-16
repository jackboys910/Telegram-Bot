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
let isResolved = false

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
    { command: '/seetopics', description: 'Посмотреть все нерешенные темы' },
    { command: '/addtopic', description: 'Добавить тему для изучения' },
    { command: '/resolve', description: 'Отметить тему как решенную' },
    { command: '/seeall', description: 'Посмотреть все темы' },
    { command: '/randomtopic', description: 'Рандомная тема из нерешенных' },
    { command: '/seeresolved', description: 'Посмотреть решенные темы' },
    { command: '/info', description: 'Получить информацию о пользователе' },
    { command: '/game', description: 'Игра угадай цифру' },
  ])

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id
    try {
      const text = msg.text

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

      if (text === '/randomtopic') {
        const res = await client.query(
          'SELECT * FROM unresolved_topics ORDER BY RANDOM() LIMIT 1'
        )
        const randomTopic = res.rows[0].topic

        const searchQueryJS = encodeURIComponent(`${randomTopic} js`)
        const searchQueryReact = encodeURIComponent(`${randomTopic} react`)
        const searchQueryTS = encodeURIComponent(`${randomTopic} typescript`)
        const searchQueryDefault = encodeURIComponent(`${randomTopic}`)

        const searchUrlJS = `https://www.google.com/search?q=${searchQueryJS}`
        const searchUrlReact = `https://www.google.com/search?q=${searchQueryReact}`
        const searchUrlTS = `https://www.google.com/search?q=${searchQueryTS}`
        const searchUrlDefault = `https://www.google.com/search?q=${searchQueryDefault}`

        return bot.sendMessage(
          chatId,
          `Случайная нерешенная тема: *${randomTopic}*
          
          *JS*: Ссылка на сайт с информацией - ${searchUrlJS}
          
          *React*: Ссылка на сайт с информацией - ${searchUrlReact}
          
          *TS*: Ссылка на сайт с информацией - ${searchUrlTS}
          
          Если тема связана с чем-то другим, то перейди по этой ссылке и допиши сам поисковой запрос - ${searchUrlDefault}`,
          { parse_mode: 'Markdown' }
        )
      }

      if (text === '/addtopic') {
        topicInStack = true
        return bot.sendMessage(chatId, 'Напишите тему для добавления в список')
      }

      if (text === '/seetopics') {
        const res = await client.query(
          'SELECT * FROM unresolved_topics ORDER BY id'
        )
        const topics = res.rows
          .map(
            (row, index) =>
              `${index + 1}. ${row.topic} (добавлено: ${row.created_at})`
          )
          .join('\n')
        return bot.sendMessage(chatId, `Нерешенные темы:\n${topics}`)
      }

      if (text === '/seeresolved') {
        const res = await client.query(
          'SELECT * FROM resolved_topics ORDER BY id'
        )
        const topics = res.rows
          .map(
            (row, index) =>
              `${index + 1}. ${row.topic} (добавлено: ${row.created_at})`
          )
          .join('\n')
        return bot.sendMessage(chatId, `Решенные темы:\n${topics}`)
      }

      if (text === '/seeall') {
        const res = await client.query('SELECT * FROM all_topics ORDER BY id')
        const topics = res.rows
          .map(
            (row, index) =>
              `${index + 1}. ${row.topic} ${row.is_resolved ? '✅' : '❌'}`
          )
          .join('\n')
        return bot.sendMessage(chatId, `Все темы:\n${topics}`)
      }

      if (text === '/resolve') {
        isResolved = true
        return bot.sendMessage(
          chatId,
          'Напиши номер темы из ВСЕХ ТЕМ, которую ты хочешь отметить как решенную'
        )
      }

      if (topicInStack) {
        topicInStack = false
        await client.query(
          'INSERT INTO unresolved_topics (topic) VALUES ($1)',
          [text]
        )
        await client.query(
          'INSERT INTO all_topics (topic, is_resolved) VALUES ($1, $2)',
          [text, false]
        )
        return bot.sendMessage(chatId, 'Тема успешно добавлена в список!')
      }

      if (isResolved) {
        isResolved = false
        const topicId = parseInt(text)
        const topicRes = await client.query(
          'SELECT * FROM unresolved_topics WHERE id = $1',
          [topicId]
        )
        if (topicRes.rows.length) {
          const topic = topicRes.rows[0].topic
          await client.query('DELETE FROM unresolved_topics WHERE id = $1', [
            topicId,
          ])
          await client.query(
            'INSERT INTO resolved_topics (topic) VALUES ($1)',
            [topic]
          )
          await client.query(
            'UPDATE all_topics SET is_resolved = $1 WHERE topic = $2',
            [true, topic]
          )
          // await client.query('SELECT renumber_unresolved_topics()')

          return bot.sendMessage(chatId, 'Тема успешно отмечена как решенная!')
        } else {
          return bot.sendMessage(
            chatId,
            'Тема с таким номером не найдена в нерешенных темах'
          )
        }
      }

      return bot.sendMessage(chatId, 'Я тебя не понимаю, напиши команду')
    } catch (error) {
      return await bot.sendMessage(
        chatId,
        'Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз позже.'
      )
    }
  })

  bot.on('callback_query', async (msg) => {
    const chatId = msg.message.chat.id
    try {
      const data = msg.data
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
    } catch (error) {
      return await bot.sendMessage(
        chatId,
        'Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз позже.'
      )
    }
  })
}

start()
