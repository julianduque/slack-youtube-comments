'use strict'

const { google } = require('googleapis')
const pino = require('pino')

const config = require('../config')
const Salesforce = require('../lib/salesforce')
const graphRequest = require('../lib/compositeGraphBuilder')

const logger = pino({
  prettyPrint: {},
  prettifier: require('pino-colada')
})

const sf = new Salesforce(config.salesforce)

// fetch video records from salesforce for fetching comments
async function fetchVideos (conn) {
  const results = await conn.query('SELECT VideoId__c, SlackUserId__c FROM Video__c WHERE Subscribed__c=true')
  return results.records
}

// fetch video comments from
async function fetchVideoComments (videos) {
  const videoComments = []
  const youtube = google.youtube({
    ...config.youtube
  })
  for (let i = 0; i < videos.length; i++) {
    let comment = {}
    comment = await youtube.commentThreads.list({
      videoId: videos[i].VideoId__c,
      maxResults: 25,
      part: 'snippet'
    })
    videoComments.push(comment)
  }
  return videoComments
}

// insert video comments in Salesforce
async function upsertlistVideoComments (videoComments, conn) {
  for (let i = 0; i < videoComments.length; i++) {
    await upsertVideoComments(videoComments[i].data.items, i, conn)
  }
}

// function to upsert video comments into Salesforce using Composite GraphAPI
async function upsertVideoComments (videoitems, graphId, conn) {
  const graph = new graphRequest.GraphBuilder().withGraphId(graphId)
  for (let i = 0; i < videoitems.length; i++) {
    const videoComment = {}
    const snippet = videoitems[i].snippet.topLevelComment.snippet
    videoComment.AuthorChannelURL__c = snippet.authorChannelUrl
    videoComment.AuthorImageURL__c = snippet.authorProfileImageUrl
    videoComment.Author_Name__c = snippet.authorDisplayName
    videoComment.CommentLikeCount__c = snippet.likeCount
    videoComment.CommentPublishedAt__c = snippet.publishedAt
    videoComment.CommentUpdatedAt__c = snippet.updatedAt
    videoComment.CommentText__c = snippet.textDisplay
    videoComment.Video__r = {}
    videoComment.Video__r.VideoId__c = snippet.videoId
    // compositeSubRequest
    const compositeSubRequest = new graphRequest.CompositeSubRequestBuilder()
      .withBody(videoComment)
      .withMethod('PATCH')
      .withReferenceId('comment' + i)
      .withUrl('/services/data/v51.0/sobjects/VideoComment__c/CommentId__c/' + videoitems[i].snippet.topLevelComment.id)
      .build()
    graph.addCompositeSubRequest(compositeSubRequest)
  }
  const graphCompositeRequest = graph.build()
  const graphApiInput = new graphRequest.CompositeGraphBuilder()
    .addGraph(graphCompositeRequest)
    .build()
  const resp = await conn.requestPost(
    '/services/data/v51.0/composite/graph',
    graphApiInput
  )
  return resp
}

async function main () {
  try {
    // connect to Salesforce
    const conn = await sf.connect()
    const videos = await fetchVideos(conn)
    const videoComments = await fetchVideoComments(videos)
    await upsertlistVideoComments(videoComments, conn)
    logger.info('Comments Updated')
  } catch (ex) {
    logger.error(ex)
  }
}

// Invoke main process
main()