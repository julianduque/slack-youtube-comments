'use strict'

const pino = require('pino')
const Salesforce = require('../lib/salesforce')
const config = require('../config')

const sf = new Salesforce(config.salesforce)

const logger = pino({
  prettyPrint: {},
  prettifier: require('pino-colada')
})

async function getVideoInfo (userId, videoId) {
  const conn = await sf.connect()

  const results = await conn.query(`
    SELECT Title__c FROM Video__c WHERE ExternalKey__c='${userId}:${videoId}'
  `)

  return results.records
}

async function unsubscribeVideo (userId, videoId) {
  const conn = await sf.connect()

  await conn.sobject('Video__c').upsert({
    ExternalKey__c: `${userId}:${videoId}`,
    Subscribed__c: false
  }, 'ExternalKey__c')
}

module.exports = {
  action: 'unsubscribe_action',
  handler: async ({ ack, client, body }) => {
    await ack()

    const [action] = body.actions
    const [userId, videoId] = action?.value?.split(':')
    logger.info(`Unsubscribing from video: ${videoId} by user: ${userId}`)

    try {
      await unsubscribeVideo(userId, videoId)
      const [videoInfo] = await getVideoInfo(userId, videoId)
      await client.chat.postMessage({
        channel: userId,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `You'll not receive more comment notifications from:\n📺 *${videoInfo.Title__c}*`
            }
          },
          {
            type: 'divider'
          }
        ],
        text: `You'll not receive more comment notifications from ${videoInfo.Title__c}`
      })
    } catch (err) {
      logger.error(`Error Unsubscribing from Video: ${err.message}`)
      await client.chat.postMessage({
        channel: userId,
        blocks: [
          {

            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `❌ I failed to unsubscribe from Video.\n\n*Reason*: ${err.message}`
            }
          }
        ],
        text: `I failed to unsubscribe from Video: ${err.message}`
      })
    }
  }
}
