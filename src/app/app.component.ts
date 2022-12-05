import { Component, Inject } from '@angular/core'
import { Platform } from '@angular/cdk/platform'
import { LocationStrategy } from '@angular/common'
import { UntypedFormGroup, UntypedFormControl } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { DOCUMENT } from '@angular/common'

import ZoomVideo from '@zoom/videosdk'
import AgoraRTC from 'agora-rtc-sdk-ng'
import { connect, createLocalTracks, createLocalVideoTrack, createLocalAudioTrack } from 'twilio-video'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  // zoom
  zoomClient: any
  zoomStream: any
  cmdChannel: any
  zoomAudioDecode: boolean = false
  zoomAudioEncode: boolean = false

  // twilio
  twilioRoom: any

  // agora
  agoraClient: any

  // state
  inSession: boolean = false
  sessionLoading: boolean = false
  camera: boolean = false
  cameraLoading: boolean = false
  mic: boolean = false
  micLoading: boolean = false
  audio: boolean = false
  audioLoading: boolean = false
  activeSpeaker: any;

  // sdk
  videoSDKProvider: string = 'zoom'

  // config
  configForm: UntypedFormGroup
  breakpoint: any

  // http://10.100.124.51:8080/test?appKey=fd9U9Hyb2pRtcRxzamyfO2CkOQ1L4E3hxMx2&appSecret=suYY2WfUtWx8UEpyTgQZOvjvmmWc0xSMo0g6&sessionKey=test&topic=testsdk&role=1&password=zoom123&mfUrl=https://zoom.us

  // Allow participants to join anytime, no waiting room

  // Advisor (Zoom Client) joined first with role 1, was host. Client (Video SDK) joined second with role 1, was co host.
  // Client (Video SDK) joined first with role 1, was host. Advisor (Zoom Client) joined second with role 1, was co host.

  // Advisor (Zoom Client) joined first with role 0, was participant. Client (Video SDK) joined second with role 0, was participant.
  // Client (Video SDK) joined first with role 0, was participant. Advisor (Zoom Client) joined second with role 0, was participant.

  // Advisor (Zoom Client) joined first with role 1, was host. Client (Video SDK) joined second with role 0, was participant.
  // Client (Video SDK) joined first with role 0, was participant. Advisor (Zoom Client) joined second with role 1, was host.

  // Advisor (Zoom Client) joined first with role 0, was participant. Client (Video SDK) joined second with role 1, was host.
  // Client (Video SDK) joined first with role 1, was host. Advisor (Zoom Client) joined second with role 0, was participant.

  constructor(public platform: Platform, private locationStrategy: LocationStrategy, public httpClient: HttpClient, @Inject(DOCUMENT) document: Document) {
    console.log('Desktop Safri?', this.platform.SAFARI)
    console.log('Desktop Chromium?', this.platform.BLINK)

    this.configForm = new UntypedFormGroup({
      videoSDKProvider: new UntypedFormControl('zoom'),
      yourName: new UntypedFormControl('Tommy'),
      sessionName: new UntypedFormControl('testsdk'),
      sessionPasscode: new UntypedFormControl('zoom123')
    })

    history.pushState(null, '', window.location.href)
    this.locationStrategy.onPopState(() => {
      history.pushState(null, '', window.location.href)
    })


    this.breakpoint = (window.innerWidth <= 700) ? 1 : 2
    // event listeners?
  }

  onResize(event: any) {
    this.breakpoint = (event.target.innerWidth <= 700) ? 1 : 2
  }

  authorize(configForm: any) {

    this.sessionLoading = true

    console.log(configForm)
    this.videoSDKProvider = configForm.videoSDKProvider

    if(this.videoSDKProvider === 'zoom') {
      this.httpClient.post('https://videosdk-sample-signature.herokuapp.com', {
        sessionName: configForm.sessionName,
        role: 0,
        sessionKey: 'test'
      }).toPromise().then((data: any) => {
        console.log(data.signature)
        this.join(data.signature, configForm)
      }).catch((error) => {
        console.log(error)
        this.sessionLoading = false
      })
    } else if(this.videoSDKProvider === 'twilio') {
      this.httpClient.post('https://twiliovideo-auth-server.herokuapp.com', {
        sessionName: configForm.sessionName,
        identity: configForm.yourName
      }).toPromise().then((data: any) => {
        console.log(data.signature)
        this.join(data.signature, configForm)
      }).catch((error) => {
        console.log(error)
        this.sessionLoading = false
      })
    } else if(this.videoSDKProvider === 'agora') {
      this.httpClient.post('http://localhost:4400', {
        sessionName: configForm.sessionName,
        role: '1'
      }).toPromise().then((data: any) => {
        console.log(data.signature)
        this.join(data.signature, configForm)
      }).catch((error) => {
        console.log(error)
        this.sessionLoading = false
      })
    }
  }

  join(token: string, configForm: any) {

    if(this.videoSDKProvider === 'zoom') {
      this.zoomClient = ZoomVideo.createClient()
      this.zoomClient.init('en-US', 'CDN')
      this.zoomClient.join(configForm.sessionName, token, configForm.yourName, configForm.sessionPasscode).then((data: any) => {
        console.log(data)
        console.log(this.zoomClient.getSessionInfo())
        this.zoomStream = this.zoomClient.getMediaStream()
        this.cmdChannel = this.zoomClient.getCommandClient()
        this.sessionLoading = false
        this.inSession = true

        console.log(this.zoomClient.getAllUser())

        if(this.zoomClient.getAllUser().length > 1) {
          this.activeSpeaker = this.zoomClient.getAllUser()[1]

          if(this.activeSpeaker.bVideoOn) {
            console.log('loading particpant video')
            this.zoomStream.renderVideo(document.getElementById('participant-canvas'), this.activeSpeaker.userId, 1920, 1080, 0, 0, 3).then((data: any) => {
              console.log(data)
            })
          }

          console.log('active speaker', this.activeSpeaker)
        }

        this.zoomClient.on('media-sdk-change', (payload: any) => {
          if (payload.type === 'audio' && payload.result === 'success') {
            if (payload.action === 'encode') {
              this.zoomAudioEncode = true
            } else if (payload.action === 'decode') {
              this.zoomAudioDecode = true
            }
          }
        })

        this.zoomClient.on('user-added', (payload: any) => {
          if(!this.activeSpeaker) {
            console.log('second user joined', payload)
            console.log(this.zoomClient.getAllUser())
            this.activeSpeaker = this.zoomClient.getAllUser().filter((user:any) => {
              return payload[0].userId === user.userId
            })[0]
          }
        })

        this.zoomClient.on('user-removed', (payload: any) => {
          // why does an error throw here?
          if(this.activeSpeaker.userId === payload[0].userId) {
            console.log('active speaker left')

            // stop rendering their video if it was on
            if(this.activeSpeaker.bVideoOn) {
              this.zoomStream.stopRenderVideo(document.getElementById('participant-canvas'), this.activeSpeaker.userId)
            }

            if(this.zoomClient.getAllUser().length > 1) {
              this.activeSpeaker = this.zoomClient.getAllUser()[1]
            } else {
              this.activeSpeaker = null
            }
          }
        })

        this.zoomClient.on('active-speaker', (payload: any) => {

          if(this.activeSpeaker.userId !== payload[0].userId && this.zoomClient.getCurrentUserInfo().userId !== payload[0].userId) {
            console.log('new active speaker', payload)

            // stop rendering existing video if it was on
            if(this.activeSpeaker.bVideoOn) {
              this.zoomStream.stopRenderVideo(document.getElementById('participant-canvas'), this.activeSpeaker.userId)
            }
            // re assign active speaker
            this.activeSpeaker = this.zoomClient.getAllUser().filter((user:any) => {
              return payload[0].userId === user.userId
            })[0]

            // render their video if it is on
            if(this.activeSpeaker.bVideoOn) {
              this.zoomStream.renderVideo(document.getElementById('participant-canvas'), this.activeSpeaker.userId, 1920, 1080, 0, 0, 3).then(() => {
                console.log(data)
              })
            }

          }
        })

        this.zoomClient.on('peer-video-state-change', (payload: any) => {

          if(!this.activeSpeaker || payload.userId === this.activeSpeaker.userId) {
            if (payload.action === 'Start') {
              this.zoomStream.renderVideo(document.getElementById('participant-canvas'), payload.userId, 1920, 1080, 0, 0, 3).then((data: any) => {
                this.activeSpeaker = this.zoomClient.getAllUser().filter((user:any) => {
                  return payload.userId === user.userId
                })[0]
              }).catch((error: any) => {
                console.log(error)
              })
            } else if (payload.action === 'Stop') {
              this.zoomStream.stopRenderVideo(document.getElementById('participant-canvas'), payload.userId).then((data: any) => {
                this.activeSpeaker = this.zoomClient.getAllUser().filter((user:any) => {
                  return payload.userId === user.userId
                })[0]
              }).catch((error: any) => {
                console.log(error)
              })
            }
          }
        })

      }).catch((error: any) => {
        console.log(error)
        this.sessionLoading = false
      })
    } else if(this.videoSDKProvider === 'twilio') {
      connect(token, { name: configForm.sessionName, audio: false, video: false}).then((data: any) => {
        this.twilioRoom = data
        console.log(`Successfully joined a Room: ${this.twilioRoom}`)
        this.sessionLoading = false
        this.inSession = true

        // createLocalVideoTrack

        // second particpant no mic control?

        // twilio only render one video at a time?

        this.twilioRoom.participants.forEach((participant: any) => {
          console.log(participant)
          participant.tracks.forEach((publication: any) => {
            console.log(publication)
            if (publication.track) {
              document.getElementById('remote-media-div')!.appendChild(publication.track.attach());


            }
          });

          participant.on('trackSubscribed', (track: any) => {
            console.log(track)
            document.getElementById('remote-media-div')!.appendChild(track.attach());


          });
        });

        this.twilioRoom.on('participantConnected', (participant: any) => {
          console.log(participant)
          participant.tracks.forEach((publication: any) => {
            console.log(publication)
            if (publication.isSubscribed) {
              const track = publication.track
              console.log(track)
              document.getElementById('remote-media-div')!.appendChild(track.attach())
            }
          })
        })

        console.log(this.twilioRoom.participants)

      }).catch((error: any) => {
        console.log(error)
        this.sessionLoading = false
      })

    } else if(this.videoSDKProvider === 'agora') {
      this.agoraClient = AgoraRTC.createClient({ codec: 'vp8', mode: 'rtc' })
      this.agoraClient.join('59dcf92e250b4392839cf3c7ea2818d0', configForm.sessionName, token).then((data: any) => {
        console.log(data)
        this.sessionLoading = false
        this.inSession = true
      }).catch((error: any) => {
        console.log(error)
        this.sessionLoading = false
      })
    }
  }

  startAudio() {
    this.audioLoading = true
    if(this.videoSDKProvider === 'zoom') {
      this.zoomStream.startAudio()
      this.mic = true
      this.audio = true
    }
  }

  unmute() {
    this.micLoading = true

    if(this.videoSDKProvider === 'zoom') {
      this.zoomStream.unmuteAudio()
      console.log('zoom mic')
      this.micLoading = false
      this.mic = true
    } else if(this.videoSDKProvider === 'twilio') {
      this.twilioRoom.localParticipant.audioTracks.forEach((publication: any) => {
        publication.track.enable()
      })

      // .createLocalAudioTrack().then(function(audioTrack) {
      //   const audioElement = audioTrack.attach()
      //   document.body.appendChild(audioElement)
      // })
      //

      console.log('twilio mic')
      this.micLoading = false
      this.mic = true
    } else if(this.videoSDKProvider === 'agora') {
      this.agoraClient.createMicrophoneAudioTrack()
      console.log('agora mic')
      this.micLoading = false
      this.mic = true
    }
  }

  mute() {
    this.micLoading = true

    if(this.videoSDKProvider === 'zoom') {
      this.zoomStream.muteAudio()
      this.micLoading = false
      this.mic = false
    } else if(this.videoSDKProvider === 'twilio') {
      this.twilioRoom.localParticipant.audioTracks.forEach((publication: any) => {
        publication.track.disable()
      })
      this.micLoading = false
      this.mic = false
    } else if(this.videoSDKProvider === 'agora') {
      this.agoraClient.createMicrophoneAudioTrack().setEnabled(false)
      this.micLoading = false
      this.mic = false
    }
  }

  startCamera() {
    this.cameraLoading = true

    if(this.videoSDKProvider === 'zoom') {
      if(this.platform.BLINK) {
        this.zoomStream.startVideo({ videoElement: document.getElementById('self-view-video') }).then(() => {
          this.cameraLoading = false
          this.camera = true
        })
      } else {
        this.zoomStream.startVideo().then(() => {
          this.zoomStream.renderVideo(document.getElementById('self-view-canvas'), this.zoomClient.getCurrentUserInfo().userId, 1920, 1080, 0, 0, 3).then(() => {
            this.cameraLoading = false
            this.camera = true
          })
        })
      }
    } else if(this.videoSDKProvider === 'twilio') {

      // works for self view
      // createLocalVideoTrack().then((localVideoTrack) => {
      //   const localMediaContainer = document.getElementById('local-media');
      //   localMediaContainer!.appendChild(localVideoTrack.attach());
      // })

      console.log(this.twilioRoom.participants)
      console.log(this.twilioRoom.participants.values())

      // works for self view and send
      createLocalVideoTrack({
        height: { ideal: 720, min: 480, max: 1080 },
        width:  { ideal: 1280, min: 640, max: 1920 },
        aspectRatio: 1.77777777778,
      }).then((localTrack: any) => {
        this.twilioRoom.localParticipant.publishTrack(localTrack);
        const localMediaContainer = document.getElementById('local-media');
        localMediaContainer!.appendChild(localTrack.attach());
      });

      // this.twilioRoom.localParticipant.videoTracks.forEach((publication: any) => {
      //   publication.enable();
      //   publication.track.start()
      //   publication.publish(publication)
      // })

      this.cameraLoading = false
      this.camera = true
    } else if(this.videoSDKProvider === 'agora') {
      this.agoraClient.createCameraVideoTrack()
      this.cameraLoading = false
      this.camera = true
    }
  }

  stopCamera() {
    this.cameraLoading = true
    this.camera = false

    if(this.videoSDKProvider === 'zoom') {
      this.zoomStream.stopVideo()
      this.cameraLoading = false
      this.camera = false
    } else if(this.videoSDKProvider === 'twilio') {

      // createLocalVideoTrack().then((localTrack: any) => {
      //   this.twilioRoom.localParticipant.publishTrack(localTrack);
      //   const localMediaContainer = document.getElementById('local-media');
      //   localMediaContainer!.appendChild(localTrack.attach());
      // });

      this.twilioRoom.localParticipant.videoTracks.forEach((publication: any) => {
        publication.unpublish();
        publication.track.stop();
      })

      this.cameraLoading = false
      this.camera = false
    } else if(this.videoSDKProvider === 'agora') {
      this.agoraClient.createCameraVideoTrack().setEnabled(false)
      this.cameraLoading = false
      this.camera = false
    }
  }

  leave() {

    this.sessionLoading = true
    this.camera = false
    this.mic = false
    this.audio = false

    setTimeout(() => {
      if(this.videoSDKProvider === 'zoom') {
        this.zoomClient.leave()
        this.sessionLoading = false
        this.inSession = false
      } else if(this.videoSDKProvider === 'twilio') {
        this.twilioRoom.disconnect()
        this.sessionLoading = false
        this.inSession = false
      } else if(this.videoSDKProvider === 'agora') {
        this.agoraClient.leave()
        this.sessionLoading = false
        this.inSession = false
      }
    }, 500)

    // destory anything?
  }

}
