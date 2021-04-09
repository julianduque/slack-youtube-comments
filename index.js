'use strict'

const { App, LogLevel } = require('@slack/bolt')
const pino = require('pino')
const commands = require('./commands')
const actions = require('./actions')
const config = require('./config')
const port = process.env.PORT || 5000

const logger = pino({
  prettyPrint: {},
  prettifier: require('pino-colada')
})

const app = new App({
  ...config.slack,
  logLevel: LogLevel.DEBUG
})

// Register Commands
for (const { name, handler } of commands) {
  app.command(name, handler)
}

// Register Actions
for (const { action, handler } of actions) {
  app.action(action, handler)
}

async function start () {
  await app.start(port)
  logger.info(`⚡️ Slack YouTube Comments is running on port ${port}`)
}

start().catch(err => {
  logger.error(err)
  process.exit(1)
})
