'use strict'

const Salesforce = require('../lib/salesforce')
const config = require('../config')
const sf = new Salesforce(config.salesforce)

module.exports = {
  name: '/yt-subscribe',
  handler: async ({ command, ack, say }) => {
    await ack()
    const { text, user_id: userId } = command
    await say(`Heya <@${userId}>, I'm Subscribing to ${text} comments`)
  }
}
