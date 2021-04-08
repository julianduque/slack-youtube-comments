'use strict'

require('dotenv').config()

const salesforce = {
  clientId: process.env.CLIENT_ID,
  privateKey: process.env.PRIVATE_KEY,
  loginUrl: process.env.LOGIN_URL,
  username: process.env.USERNAME
}

const slack = {
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
}

const youtube = {
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
}

module.exports = {
  salesforce,
  youtube,
  slack
}
