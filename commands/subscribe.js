'use strict'

const pino = require('pino')
const youtubeUrl = require('youtube-url')
const { google } = require('googleapis')

const Salesforce = require('../lib/salesforce')
const config = require('../config')

const logger = pino({
  prettyPrint: {},
  prettifier: require('pino-colada')
})

const sf = new Salesforce(config.salesforce)

// Get Video Data from YouTube
async function getVideoData (videoId) {
  logger.info(`Retrieving Video Data - id: ${videoId}`)
  const youtube = google.youtube({
    ...config.youtube
  })

  const list = await youtube.videos.list({
    id: videoId,
    part: 'snippet,statistics'
  })

  return list?.data?.items?.shift()
}

// Store Video Object in Salesforce
async function saveSubscription (video) {
  const conn = await sf.connect()

  await conn.sobject('Video__c').upsert({
    ExternalKey__c: `${video.slackUserId}:${video.videoId}`,
    Title__c: video.title,
    SlackUserId__c: video.slackUserId,
    SlackUser__c: video.slackUsername,
    VideoDescription__c: video.description,
    VideoId__c: video.videoId,
    VideoURL__c: video.videoUrl,
    ThumbnailURL__c: video.thumbnailUrl,
    ViewCount__c: video.viewCount,
    LikeCount__c: video.likeCount,
    DislikeCount__c: video.dislikeCount,
    CommentCount__c: video.commentCount,
    FavoriteCount__c: video.favoriteCount,
    Tags__c: video.tags,
    Subscribed__c: true
  }, 'ExternalKey__c')
}

module.exports = {
  name: '/yt-subscribe',
  handler: async ({ command, client, ack }) => {
    await ack()
    const { text, user_id: userId, user_name: userName } = command

    if (!youtubeUrl.valid(text)) {
      await client.chat.postMessage({
        channel: userId,
        text: 'Please provide a valid YouTube URL'
      })
      return
    }

    const videoId = youtubeUrl.extractId(text)
    const { snippet, statistics } = await getVideoData(videoId)
    const title = snippet.title

    try {
      logger.info(`Saving Subscription into Salesforce for user:${userId} and video:${videoId}`)
      await saveSubscription({
        title,
        videoId,
        videoUrl: text,
        description: snippet?.description,
        thumbnailUrl: snippet?.thumbnails?.maxres?.url,
        tags: snippet?.tags?.join(',').substring(0, 255),
        slackUserId: userId,
        slackUsername: userName,
        ...statistics
      })
    } catch (err) {
      logger.error(`Error storing in Salesforce: ${err.message}`)
      await client.chat.postMessage({
        channel: userId,
        blocks: [
          {

            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `❌ I failed to subscribe on that video.\n\n*Reason*: ${err.message}`
            }
          }
        ],
        text: `I failed to subscribe on that video: ${err.message}`
      })
      return
    }

    await client.chat.postMessage({
      channel: userId,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `👋 Howdy <@${userId}>,

💬 I'll keep you posted about comments from\n📺 *${title}*
              `
          }
        },
        {
          type: 'divider'
        }
      ],
      text: `I'll keep you posted about comments from ${title}`
    })
  }
}
