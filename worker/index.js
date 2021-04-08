"use strict"

const { google } = require('googleapis');
const sfconnection = require('./service/sfconnection').sfconnection;
const graphRequest = require('./service/compositeGraphBuilder');

// fetch video records from salesforce for fetching comments
async function fetchVideos(conn) {
    const results = await conn.query("SELECT VideoId__c, SlackUserId__c FROM Video__c WHERE Subscribed__c=true");
    return results.records;
}

// fetch video comments from 
async function fetchVideoComments(videos) {
    let videoComments = [];
    const youtube = google.youtube({
        version: 'v3',
        auth: process.env.YOUTUBE_API_KEY
    });
    for (let i = 0; i < videos.length; i++) {
        let comment = {};
        comment = await youtube.commentThreads.list({
            videoId: videos[i].VideoId__c,
            maxResults: 25,
            part: 'snippet'
        });
        videoComments.push(comment);
    }
    return videoComments;
}

// insert video comments in Salesforce
async function upsertlistVideoComments(videoComments, conn) {
    for (let i = 0; i < videoComments.length; i++) {
        await upsertVideoComments(videoComments[i].data.items, i, conn);
    }
}

// function to upsert video comments into Salesforce using Composite GraphAPI
async function upsertVideoComments(videoitems, graphId, conn) {
    const graph = new graphRequest.GraphBuilder().withGraphId(graphId);
    for (let i = 0; i < videoitems.length; i++) {
        let videoComment = {};
        const snippet = videoitems[i].snippet.topLevelComment.snippet;
        videoComment.AuthorChannelURL__c = snippet.authorChannelUrl;
        videoComment.AuthorImageURL__c = snippet.authorProfileImageUrl;
        videoComment.Author_Name__c = snippet.authorDisplayName;
        videoComment.CommentLikeCount__c = snippet.likeCount;
        videoComment.CommentPublishedAt__c = snippet.publishedAt;
        videoComment.CommentUpdatedAt__c = snippet.updatedAt;
        videoComment.CommentText__c = snippet.textDisplay;
        videoComment.Video__r = {};
        videoComment.Video__r.VideoId__c = snippet.videoId;
        // compositeSubRequest 
        const compositeSubRequest = new graphRequest.CompositeSubRequestBuilder()
            .withBody(videoComment)
            .withMethod("PATCH")
            .withReferenceId("comment" + i)
            .withUrl("/services/data/v51.0/sobjects/VideoComment__c/CommentId__c/" + videoitems[i].snippet.topLevelComment.id)
            .build();
        graph.addCompositeSubRequest(compositeSubRequest);
    }
    const graphCompositeRequest = graph.build();
    const graphApiInput = new graphRequest.CompositeGraphBuilder()
        .addGraph(graphCompositeRequest)
        .build();
    const resp = await conn.requestPost(
        '/services/data/v51.0/composite/graph',
        graphApiInput
    );
    console.log(JSON.stringify(resp));
}

async function main() {
    try {
        // connect to Salesforce
        const conn = await sfconnection();
        const videos = await fetchVideos(conn);
        const videoComments = await fetchVideoComments(videos);
        const response = await upsertlistVideoComments(videoComments, conn);
    } catch (ex) {
        console.log(ex);
    }

}

// Invoke main process
(async () => {
    main();
})();