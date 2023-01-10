# Zoom Video SDK vs. Twilio Video for web

## Overview

In this article, I will highlight the technical and developer experience advantages of the Zoom Video SDK compared with Twilio Video. To give the most accurate comparison possible, I developed the same Video Chat UI, the only difference being the video provider.


![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dpouqnkp0erbr9el968v.png)


This article can also be used as a reference when migrating from Twilio Video to the Zoom Video SDK.

## Install

Both the Twilio Video and Zoom Video SDK can be installed from NPM or a CDN script tag.

Twilio: 
```
$ npm install twilio-video
```

Zoom: 

```
$ npm install @zoom/videosdk
```

## Import

Twilio:

```js
import * as TwilioVideo from 'twilio-video'

var twilioVideo = TwilioVideo
var twilioSession
```

Zoom:

```js
import ZoomVideo from '@zoom/videosdk'

var zoomVideo = ZoomVideo.createClient()
var zoomSession

zoomVideo.init('en-US', 'CDN')
```

## Auth

Both Zoom and Twilio use JWT tokens to authorize the use of the SDK and to generate a token for users to join.

## Joining

Zoom offers the ability to specify a Session Name and Passcode, whereas Twilio does not offer a Session Passcode, making it more work for a developer to implement a secure join flow.

Twilio:

```js
twilioVideo.connect(token, { name: 'yourName', audio: false, video: false, dominantSpeaker: true }).then((session) => {
    twilioSession = session
})
```

Zoom:

```js
zoomVideo.join('sessionName', token, 'yourName', 'sessionPasscode').then((session) => {
    zoomSession = session
})
```

## Video

Video is the core feature of these SDK products. Apart from the WebAssembly technology that Zoom uses, the other big advantage is that Virtual Backgrounds and Blurred Backgrounds are built in features to the Zoom Video SDK, where as Twilio requires a separate virtual background SDK.

### Turning Camera On

Twilio has a concept of multiple video and audio tracks, which is always an array, making the developer experince more difficult for use cases where only one or two videos need to be sent from a connected user.

To render the self view, twilio appends a video element inside the specified div.

Twilio:

```html
<div class="twilio-self-view-div" width="1920" height="1080"></div>
```

```css
#twilio-self-view-div video {
    width: 100%;
    height: auto;
    aspect-ratio: 16/9;
}
```

```js
twilioVideo.createLocalVideoTrack({
   height: { ideal: 720, min: 480, max: 1080 },
   width:  { ideal: 1280, min: 640, max: 1920 },
   aspectRatio: 16/9,
}).then((localVideoTrack) => {
        
   twilioSession.localParticipant.publishTrack(localVideoTrack)
   
   const localMediaContainer = document.getElementById('twilio-self-view-div')
        
   localMediaContainer!.appendChild(localVideoTrack.attach())
});
```

Zoom:

Up to two video streams can be sent per connected user. The second being through a 2nd camera via the screenshare channel.

Starting and rendering your video with the Zoom Video SDK requires more logic because we optimize video performance for each device and browser. We are always improving the developer experience to make this logic easier to implement.

Zoom renders the self view on the canvas or video element that you set, respectively.

```html
<video class="self-view-video" width="1920" height="1080"></video>
<canvas class="self-view-canvas" width="1920" height="1080"></canvas>
```

```css
video, canvas {
    width: 100%;
    height: auto;
    aspect-ratio: 16/9;
}
```

```js
if((!zoomSession.isSupportMultipleVideos() && (typeof OffscreenCanvas === 'function')) || /android/i.test(navigator.userAgent)) {
    // start video - video will render automatically on HTML Video Element if MediaStreamTrackProcessor is supported
    zoomSession.startVideo({ videoElement: document.getElementById('self-view-video') }).then(() => {
        // if MediaStreamTrackProcessor is not supported
        if(!(typeof MediaStreamTrackProcessor === 'function')) {
            // render video on HTML Canvas Element
            zoomSession.renderVideo(document.getElementById('self-view-canvas'), zoomVideo.getCurrentUserInfo().userId, 1920, 1080, 0, 0, 2).then(() => {
                // show HTML Canvas Element in DOM
            })
        } else {
            // show HTML Video Element in DOM
        }
    })
// desktop Chrome, Edge, and Firefox with SharedArrayBuffer enabled, and all other browsers
} else {
    // start video
    zoomSession.startVideo().then(() => {
        // render video on HTML Canvas Element
        zoomSession.renderVideo(document.getElementById('self-view-canvas'), zoomVideo.getCurrentUserInfo().userId, 1920, 1080, 0, 0, 2).then(() => {
            // show HTML Canvas Element in DOM
        })
    })
}
```

### Turning Camera Off

Twilio:

Since Twilio Video is based on tracks, you need to loop through each video track to unpublish the video, stop the video camera, and remove the video element from the dom.

```js
twilioSession.localParticipant.videoTracks.forEach((publication) => {
    publication.unpublish();
    publication.track.stop();
    var selfTwilioVideo = document.getElementById('twilio-self-view-div')
    selfTwilioVideo?.querySelector('video')?.remove()
})
```

Zoom:

Zoom makes this simple by providing one simple function.

```js
zoomSession.stopVideo()
```

## Audio

### Starting Audio

Twilio:

Again, since Twilio Video is based on tracks, you need to loop through each audio track to start the audio, and add the audio element to the dom.

```js
twilioVideo.createLocalAudioTrack().then((localAudioTrack) => {
    twilioSession.localParticipant.publishTrack(localAudioTrack);
    const audioElement = localAudioTrack.attach();
    document.body.appendChild(audioElement);
})
```

Zoom:

Zoom makes this simple by providing one simple function.

```js
session.startAudio()
```

### Muting

Twilio:

Again, since Twilio Video is based on tracks, you need to loop through each audio track to mute the microphone.

```js
twilioSession.localParticipant.audioTracks.forEach((publication) => {
    publication.track.disable()
})
```

Zoom:

Zoom makes this simple by providing one simple function.

```js
stream.mute()
```

### Unmuting

Twilio:

Again, since Twilio Video is based on tracks, you need to loop through each audio track to unmute the microphone.


```js
twilioSession.localParticipant.audioTracks.forEach((publication) => {
    publication.track.enable()
})
```

Zoom:

Zoom makes this simple by providing one simple function.

```js
stream.unmuteAudio()
```

## Participants

Now let's talk about participant management. Both Zoom and Twilio have event listeners to maintain the state of your Video Chat for everyone connected. In general the states we want to keep track of are:

- User's Connection changes (joining, leaving)
- User's Video changes (turning off and on the camera)
- User's Audio changes (starting audio, muting, and unmuting the mic)

### Connection changes

Twilio and Zoom have user connection change event listeners. These are useful for rendering a user when they join, showing a mute/unmute icon next to their name to show other users their mic state, and remove users from the DOM when they leave.

However, Twilio does not have a user updated event listener, which makes it difficult to show other users mute/unmute state.

Twilio:

```js
twilioSession.on('participantConnected', (participant) => {
    // user joined
})

twilioVideo.on('participantDisconnected', (participant) => {
    // user left
})
```

Zoom:

```js
zoomVideo.on('user-added', (payload) => {
    // user joined
})

zoomVideo.on('user-updated', (payload) => {
    // user updated, like unmuting and muting
})

zoomVideo.on('user-removed', (payload) => {
    // user left
})
```

### Video changes

Twilio:

Keeping track of users video states is more difficult with Twilio because you need to nest event listeners.

```js
twilioSession.on('participantConnected', (participant: any) => {

    participant.on('trackSubscribed', (track: any) => {
        // users video or audio track stopped
    });

    participant.on('trackUnsubscribed', (track: any) => {
        // users video or audio track stopped
    })
})
```

Zoom:

```js
zoomVideo.on('peer-video-state-change', (payload) => {

    if (payload.action === 'Start') {
        // a user turned on their video
    } else if (payload.action === 'Stop') {
        // a user turned off their video
    }
})
```

### Audio changes

Twilio and Zoom both have active speaker change event listeners. These are useful if you want to highlight the user who is speaking.

Twilio:

```js
twilioVideo.on('dominantSpeakerChanged', (participant) => {
    // new active speaker
})
```

Zoom:

```js
zoomVideo.on('active-speaker', (payload) => {
    // new active speaker
})
```

## Leaving

Twilio:

```js
twilioVideo.disconnect()
```

Zoom:

```js
zoomVideo.leave()
```

## Conclusion

In general the Zoom Video SDK is more simple to implement and maintain. The Twilio Video SDK is more work due to the requiremnt to handle use cases with multiple video tracks from a single user, and dealing with JavaScript Maps instead of developer friendly Arrays and Objects.

Zoom also has a number of additional features like live transcription and translation, Cloud Recording, PSTN Call Out, SIP/H323 Call Out, Chat, Screenshare, Command Channel, addtional Video SDK platforms like macOS, Windows, iOS, Android, and Linux, and a suite of REST APIs and Webhooks.

To get started with the Zoom Video SDK for free, [sign up for Video SDK credentials](https://zoom.us/buy/videosdk), checkout the [documentation](https://marketplace.zoom.us/docs/sdk/video/introduction/), or reach out to a [Zoom Developer Advocate](https://devforum.zoom.us/c/video-sdk/55).