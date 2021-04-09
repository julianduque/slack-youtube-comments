'use strict'

const pino = require('pino')

const Salesforce = require('../lib/salesforce')
const config = require('../config')

const logger = pino({
  prettyPrint: {},
  prettifier: require('pino-colada')
})

const sf = new Salesforce(config.salesforce)

async function getVideoSubscriptions (userId) {
  const conn = await sf.connect()

  const results = await conn.query(`
    SELECT Title__c, VideoDescription__c, VideoId__c, ThumbnailURL__c
    FROM Video__c
    WHERE Subscribed__c = true
    AND SlackUserId__c = '${userId}'
  `)
  return results.records
}

module.exports = {
  name: '/yt-unsubscribe',
  handler: async ({ command, client, ack, say }) => {
    await ack()
    const { user_id: userId } = command
    try {
      logger.info(`Retrieving Subscription List for user:${userId}`)
      const subscriptions = await getVideoSubscriptions(userId)

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'YouTube Video Subscriptions',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `👋 Howdy <@${userId}>, here is a list of your current Video Subscriptions:`
          }
        },
        {
          type: 'divider'
        }
      ]

      subscriptions.forEach(subscription => {
        const section =
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${subscription.Title__c}*\n${subscription.VideoDescription__c?.substring(0, 100)}`
            },
            accessory: {
              type: 'image',
              image_url: subscription.ThumbnailURL__c,
              alt_text: 'title'
            }
          }
        blocks.push(section)

        const action =
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Unsubscribe',
                  emoji: true
                },
                value: `${userId}:${subscription.VideoId__c}`,
                action_id: 'unsubscribe_action',
                style: 'danger'
              }
            ]
          }
        blocks.push(action)
        blocks.push({ type: 'divider' })
      })

      await client.chat.postMessage({
        channel: userId,
        blocks
      })
    } catch (err) {
      logger.error(`Error retrieving Subscription List: ${err.message}`)
      await client.chat.postMessage({
        channel: userId,
        blocks: [
          {

            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `❌ I failed to retrieve Subscription List - *Reason*: ${err.message}`
            }
          }
        ],
        text: `I failed to retrieve Subscription List: ${err.message}`
      })
    }
  }
}
