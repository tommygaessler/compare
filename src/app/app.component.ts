import { Component, Inject } from '@angular/core'
import { Platform } from '@angular/cdk/platform'
import { LocationStrategy } from '@angular/common'
import { UntypedFormGroup, UntypedFormControl } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { DOCUMENT } from '@angular/common'
import { MatSnackBar, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';

import ZoomVideo from '@zoom/videosdk'
import AgoraRTC from 'agora-rtc-sdk-ng'
// import { connect, createLocalTracks, createLocalVideoTrack, createLocalAudioTrack } from 'twilio-video'
import * as TwilioVideo from 'twilio-video'

declare var MediaStreamTrackProcessor: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  // zoom
  zoomVideo: any
  zoomSession: any
  zoomAudioDecode: boolean = false
  zoomAudioEncode: boolean = false
  useVideoElementForZoom: boolean = false
  useCanvasElementForZoom: boolean = false

  // twilio
  twilioVideo: any = TwilioVideo
  twilioSession: any

  // agora
  agoraClient: any

  // state
  session: boolean = false
  sessionLoading: boolean = false
  sessionError: boolean = false
  camera: boolean = false
  cameraLoading: boolean = false
  cameraError: boolean = false
  mic: boolean = false
  micLoading: boolean = false
  micError: boolean = false
  audio: boolean = false
  audioLoading: boolean = false
  audioError: boolean = false
  
  activeSpeaker: any;

  // sdk
  videoSDKProvider: string = 'zoom'

  // config
  configForm: UntypedFormGroup
  breakpoint: any

  constructor(public platform: Platform, private locationStrategy: LocationStrategy, public httpClient: HttpClient, @Inject(DOCUMENT) document: Document, private _snackBar: MatSnackBar) {
    console.log('Desktop Safri?', this.platform.SAFARI)

    this.configForm = new UntypedFormGroup({
      videoSDKProvider: new UntypedFormControl('zoom'),
      yourName: new UntypedFormControl('User A'),
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
      this.httpClient.post('https://or116ttpz8.execute-api.us-west-1.amazonaws.com/default/videosdk', JSON.stringify({
        sessionName: configForm.sessionName,
        role: 0
      })).toPromise().then((data: any) => {
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
      this.zoomVideo = ZoomVideo.createClient()
      this.zoomVideo.init('en-US', 'CDN')
      this.zoomVideo.join(configForm.sessionName, token, configForm.yourName, configForm.sessionPasscode).then((data: any) => {
        console.log(data)
        console.log(this.zoomVideo.getSessionInfo())
        this.zoomSession = this.zoomVideo.getMediaStream()
        this.sessionLoading = false
        this.session = true

        console.log(this.zoomVideo.getAllUser())

        if(this.zoomVideo.getAllUser().length > 1) {
          this.activeSpeaker = this.zoomVideo.getAllUser()[1]

          if(this.activeSpeaker.bVideoOn) {
            // could add a loader here for particpant video
            console.log('loading particpant video')
            this.zoomSession.renderVideo(document.getElementById('participant-canvas'), this.activeSpeaker.userId, 1920, 1080, 0, 0, 2).then((data: any) => {
              console.log(data)
            })
          }

          console.log('active speaker', this.activeSpeaker)
        }

        this.zoomVideo.on('media-sdk-change', (payload: any) => {
          if (payload.type === 'audio' && payload.result === 'success') {
            if (payload.action === 'encode') {
              this.zoomAudioEncode = true
            } else if (payload.action === 'decode') {
              this.zoomAudioDecode = true
            }
          }
        })

        this.zoomVideo.on('user-added', (payload: any) => {

          this._snackBar.open(payload[0].displayName + ' joined', '', {
            verticalPosition: 'top',
            duration: 2 * 1000,
          });

          if(!this.activeSpeaker) {
            console.log('second user joined', payload)
            console.log(this.zoomVideo.getAllUser())
            this.activeSpeaker = this.zoomVideo.getAllUser().filter((user:any) => {
              return payload[0].userId === user.userId
            })[0]
          }
        })

        this.zoomVideo.on('user-updated', (payload: any) => {
          // why does this trigger for myself? Maybe an edge case here?
          if(this.zoomVideo.getCurrentUserInfo() && this.zoomVideo.getCurrentUserInfo().userId !== payload[0].userId) {
            if(payload[0].userId === this.activeSpeaker.userId) {
              if("audio" in payload[0]) {
                this.activeSpeaker.audio = payload[0].audio
              } else if("muted" in payload[0]) {
                this.activeSpeaker.muted = payload[0].muted
              }
            }
          }
        })

        // why does user-removed trigger when a user joins? Somethings happens?
        this.zoomVideo.on('user-removed', (payload: any) => {
          // why does an error throw here?
          if(this.activeSpeaker.userId === payload[0].userId) {
            console.log('active speaker left')

            // stop rendering their video if it was on
            if(this.activeSpeaker.bVideoOn) {
              this.zoomSession.stopRenderVideo(document.getElementById('participant-canvas'), this.activeSpeaker.userId)
            }

            if(this.zoomVideo.getAllUser().length > 1) {
              this.activeSpeaker = this.zoomVideo.getAllUser()[1]

              if(this.activeSpeaker.bVideoOn) {
                this.zoomSession.renderVideo(document.getElementById('participant-canvas'), this.activeSpeaker.userId, 1920, 1080, 0, 0, 2).then(() => {
                  console.log(data)
                })
              }
            } else {
              this.activeSpeaker = null
            }
          }

          this._snackBar.open(payload[0].userId + ' left', '', {
            verticalPosition: 'top',
            duration: 2 * 1000,
          });
        })

        this.zoomVideo.on('active-speaker', (payload: any) => {

          if(this.activeSpeaker.userId !== payload[0].userId && this.zoomVideo.getCurrentUserInfo().userId !== payload[0].userId) {
            console.log('new active speaker', payload)

            // stop rendering existing video if it was on
            if(this.activeSpeaker.bVideoOn) {
              this.zoomSession.stopRenderVideo(document.getElementById('participant-canvas'), this.activeSpeaker.userId)
            }
            // re assign active speaker
            this.activeSpeaker = this.zoomVideo.getAllUser().filter((user:any) => {
              return payload[0].userId === user.userId
            })[0]

            console.log(this.activeSpeaker)

            // render their video if it is on
            if(this.activeSpeaker.bVideoOn) {
              // could add a loader here for particpant video
              this.zoomSession.renderVideo(document.getElementById('participant-canvas'), this.activeSpeaker.userId, 1920, 1080, 0, 0, 2).then(() => {
                console.log(data)
              })
            }

          }
        })

        this.zoomVideo.on('peer-video-state-change', (payload: any) => {

          if(!this.activeSpeaker || payload.userId === this.activeSpeaker.userId) {
            if (payload.action === 'Start') {
              // could add a loader here for particpant video
              this.zoomSession.renderVideo(document.getElementById('participant-canvas'), payload.userId, 1920, 1080, 0, 0, 2).then((data: any) => {
                this.activeSpeaker = this.zoomVideo.getAllUser().filter((user:any) => {
                  return payload.userId === user.userId
                })[0]
              }).catch((error: any) => {
                console.log(error)
              })
            } else if (payload.action === 'Stop') {
              this.zoomSession.stopRenderVideo(document.getElementById('participant-canvas'), payload.userId).then((data: any) => {
                this.activeSpeaker = this.zoomVideo.getAllUser().filter((user:any) => {
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
      this.twilioVideo.connect(token, { name: configForm.sessionName, audio: false, video: false, dominantSpeaker: true }).then((data: any) => {
        this.twilioSession = data
        console.log(`Successfully joined a Room: ${this.twilioSession}`)
        this.sessionLoading = false
        this.session = true

        console.log(this.twilioSession.participants)
        console.log()

        // set active speaker
        if(Array.from(this.twilioSession.participants, ([name, value]) => ({name, value})).length) {
          console.log(this.twilioSession.participants[1])
          this.activeSpeaker = Array.from(this.twilioSession.participants, ([name, value]) => ({name, value}))[0]

          console.log(this.activeSpeaker)

          if(this.activeSpeaker.value.videoTracks.size) {
            // could add a loader here for particpant video
            console.log('load particpant video')
          }

          console.log('active speaker', this.activeSpeaker)
        }

        this.twilioSession.participants.forEach((participant: any) => {
          console.log(participant)
          participant.tracks.forEach((publication: any) => {
            console.log(publication)
            if (publication.track) {
              console.log('render the particpant video')
              document.getElementById('twilio-user-view-div')!.appendChild(publication.track.attach());

              publication.track.on('disabled', () => {
                console.log('did I mute?')
              });

              publication.track.on('enabled', () => {
                console.log('did I unmute?')
              });
            }
          });

          participant.on('trackSubscribed', (track: any) => {
            console.log(track)

            if(participant.sid === this.activeSpeaker.value.sid) {
              console.log('adding video?')
              document.getElementById('twilio-user-view-div')!.appendChild(track.attach());
            }
            
            track.on('disabled', () => {

              if(participant.sid === this.activeSpeaker.value.sid) {
                this.activeSpeaker.value.muted = true
              }

              console.log('did I mute again?')
            });

            track.on('enabled', () => {

              if(participant.sid === this.activeSpeaker.value.sid) {
                this.activeSpeaker.value.muted = false
              }

              console.log('did I unmute again?')
            });

          });

          participant.on('trackUnsubscribed', (track: any) => {
            console.log('a video was stopped')

            if(participant.sid === this.activeSpeaker.value.sid) {
              var selfTwilioVideo = document.getElementById('twilio-user-view-div')
              selfTwilioVideo?.querySelector('video')?.remove()
            }
            
          })
        });

        this.twilioSession.on('participantConnected', (participant: any) => {
          console.log(participant)

          this._snackBar.open(participant.identity + ' joined', '', {
            verticalPosition: 'top',
            duration: 2 * 1000,
          });

          // set active speaker
          if(Array.from(this.twilioSession.participants, ([name, value]) => ({name, value})).length) {
            console.log(this.twilioSession.participants[1])
            this.activeSpeaker = Array.from(this.twilioSession.participants, ([name, value]) => ({name, value}))[0]

            console.log(this.activeSpeaker)

            if(this.activeSpeaker.value.videoTracks.size) {
              // could add a loader here for particpant video
              console.log('load particpant video')
            }

            console.log('active speaker', this.activeSpeaker)
          }

          participant.tracks.forEach((publication: any) => {
            console.log(publication)
            // if (publication.isSubscribed) {
            //   const track = publication.track
            //   console.log(track)
            //   document.getElementById('twilio-user-view-div')!.appendChild(track.attach())
            // }

            if (publication.track) {
              document.getElementById('twilio-user-view-div')!.appendChild(publication.track.attach());

              publication.track.on('disabled', () => {
                console.log('did I mute? 2')

                console.log(participant)
              });

              publication.track.on('enabled', () => {
                console.log('did I unmute? 2')

                if(participant.sid === this.activeSpeaker.value.sid) {
                  this.activeSpeaker.value.muted = true
                }
              });
            }
          })

          participant.on('trackSubscribed', (track: any) => {
            console.log(track)

            // only render if active speaker
            if(participant.sid === this.activeSpeaker.value.sid) {
              console.log('adding video?')
              document.getElementById('twilio-user-view-div')!.appendChild(track.attach());
            }

            track.on('disabled', () => {
              console.log('did I mute again? 2')

              if(participant.sid === this.activeSpeaker.value.sid) {
                this.activeSpeaker.value.muted = true
              }
            });

            track.on('enabled', () => {
              console.log('did I unmute again? 2')

              if(participant.sid === this.activeSpeaker.value.sid) {
                this.activeSpeaker.value.muted = false
              }
            });

          });

          participant.on('trackUnsubscribed', (track: any) => {
            console.log('a video was stopped')

            // only stop rendering if active speaker
            console.log('removing video?')

            if(participant.sid === this.activeSpeaker.value.sid) {
              var selfTwilioVideo = document.getElementById('twilio-user-view-div')
              selfTwilioVideo?.querySelector('video')?.remove()
            }
          })
        })

        this.twilioSession.on('participantDisconnected', (participant: any) => {
          console.log('someone left', participant)

          // if active speaker, change active speaker.

          if(participant.sid === this.activeSpeaker.value.sid) {
            // do nothing, speaker is already active speaker

            var selfTwilioVideo = document.getElementById('twilio-user-view-div')
            selfTwilioVideo?.querySelector('video')?.remove()

            this.activeSpeaker = this.activeSpeaker = Array.from(this.twilioSession.participants, ([name, value]) => ({name, value}))[0]
            console.log('new user talking change view', this.activeSpeaker)

            if(this.activeSpeaker.value.videoTracks.size) {
              console.log(Array.from(this.activeSpeaker.value.videoTracks, ([name, value]) => ({name, value})))
              document.getElementById('twilio-user-view-div')!.appendChild(Array.from(this.activeSpeaker.value.videoTracks, ([name, value]) => ({name, value}))[0].value.track.attach());
            }

          } else {
            // stop rendering the previous active speakers video, render the first user in the list

            // var selfTwilioVideo = document.getElementById('twilio-user-view-div')
            // selfTwilioVideo?.querySelector('video')?.remove()

            // this.activeSpeaker = this.activeSpeaker = Array.from(this.twilioSession.participants, ([name, value]) => ({name, value}))[0]
            // console.log('new user talking change view', this.activeSpeaker)

            // if(this.activeSpeaker.value.videoTracks.size) {
            //   console.log(Array.from(this.activeSpeaker.value.videoTracks, ([name, value]) => ({name, value})))
            //   document.getElementById('twilio-user-view-div')!.appendChild(Array.from(this.activeSpeaker.value.videoTracks, ([name, value]) => ({name, value}))[0].value.track.attach());
            // }

            // document.getElementById('twilio-user-view-div')!.appendChild(this.activeSpeaker.value.videoTracks.attach());
          }

          this._snackBar.open(participant.identity + ' left', '', {
            verticalPosition: 'top',
            duration: 2 * 1000,
          });

        })

        this.twilioSession.on('dominantSpeakerChanged', (participant: any) => {
          console.log(participant);
          console.log(participant.identity, participant.sid)

          console.log(participant.sid === this.activeSpeaker.value.sid)

          // twilio to do: active speaker logic, user list logic, audio

          if(participant) {
            if(participant.sid === this.activeSpeaker.value.sid) {
              // do nothing, speaker is already active speaker
            } else {
              // stop rendering the previous active speakers video, render the new video
              console.log('swicth video')
              var selfTwilioVideo = document.getElementById('twilio-user-view-div')
              selfTwilioVideo?.querySelector('video')?.remove()


              this.activeSpeaker.value = participant

              if(this.activeSpeaker.value.videoTracks.size) {
                console.log(Array.from(this.activeSpeaker.value.videoTracks, ([name, value]) => ({name, value})))
                document.getElementById('twilio-user-view-div')!.appendChild(Array.from(this.activeSpeaker.value.videoTracks, ([name, value]) => ({name, value}))[0].value.track.attach());
              }
              

              setTimeout(() => {
                console.log(this.activeSpeaker)
              })

              // document.getElementById('twilio-user-view-div')!.appendChild(this.activeSpeaker.value.videoTracks.attach());
            }
          } else {
            // if null don't do anything
          }

          // set active speaker when 2nd user joins

          // set active speaker to null when 2nd user leaves.
          // if active speaker leaves, set active speaker to 2nd user in the list
        });

        console.log(this.twilioSession.localParticipant)
        let whyTwilio = Array.from(this.twilioSession.participants, ([name, value]) => ({name, value}))
        console.log(whyTwilio)

      }).catch((error: any) => {
        console.log(error)
        this.sessionLoading = false
      })

    } else if(this.videoSDKProvider === 'agora') {
      this.agoraClient = AgoraRTC.createClient({ codec: 'vp8', mode: 'rtc' })
      this.agoraClient.join('59dcf92e250b4392839cf3c7ea2818d0', configForm.sessionName, token).then((data: any) => {
        console.log(data)
        this.sessionLoading = false
        this.session = true
      }).catch((error: any) => {
        console.log(error)
        this.sessionLoading = false
      })
    }
  }

  startAudio() {
    this.audioLoading = true
    if(this.videoSDKProvider === 'zoom') {
      this.zoomSession.startAudio()
      this.mic = true
      this.audio = true
      this.audioLoading = false
    } else if(this.videoSDKProvider === 'twilio') {
      this.twilioVideo.createLocalAudioTrack().then((localAudioTrack: any) => {
        this.twilioSession.localParticipant.publishTrack(localAudioTrack);
        const audioElement = localAudioTrack.attach();
        document.body.appendChild(audioElement);

        console.log('twilio mic')

        // this.twilioSession.localParticipant.audioTracks.forEach((publication: any) => {
        //   publication.enable()
        // })

        this.micLoading = false
        this.mic = true
        this.audio = true
      })
    }
  }

  unmute() {
    this.micLoading = true

    if(this.videoSDKProvider === 'zoom') {
      this.zoomSession.unmuteAudio()
      console.log('zoom mic')
      this.micLoading = false
      this.mic = true
    } else if(this.videoSDKProvider === 'twilio') {
      this.twilioSession.localParticipant.audioTracks.forEach((publication: any) => {
        publication.track.enable()
      })

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
      this.zoomSession.muteAudio()
      this.micLoading = false
      this.mic = false
    } else if(this.videoSDKProvider === 'twilio') {
      this.twilioSession.localParticipant.audioTracks.forEach((publication: any) => {
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

      if((!this.zoomSession.isSupportMultipleVideos() && (typeof OffscreenCanvas === 'function')) || /android/i.test(navigator.userAgent)) {
        // start video - video will render automatically on HTML Video Element if MediaStreamTrackProcessor is supported
        this.zoomSession.startVideo({ videoElement: document.getElementById('self-view-video') }).then(() => {
           // if MediaStreamTrackProcessor is not supported
           if(!(typeof MediaStreamTrackProcessor === 'function')) {
              // render video on HTML Canvas Element
              this.zoomSession.renderVideo(document.getElementById('self-view-canvas'), this.zoomVideo.getCurrentUserInfo().userId, 1920, 1080, 0, 0, 2).then(() => {
                // show HTML Canvas Element in DOM
                this.useCanvasElementForZoom = true
                this.cameraLoading = false
                this.camera = true
              }).catch((error: any) => {
                 console.log(error)
              })
            } else {
                // show HTML Video Element in DOM
                this.useVideoElementForZoom = true
                this.cameraLoading = false
                this.camera = true
            }
          }).catch((error: any) => {
            console.log(error)
          })
          // desktop Chrome, Edge, and Firefox with SharedArrayBuffer enabled, and all other browsers
        } else {
          // start video
          this.zoomSession.startVideo().then(() => {
            // render video on HTML Canvas Element
            this.zoomSession.renderVideo(document.getElementById('self-view-canvas'), this.zoomVideo.getCurrentUserInfo().userId, 1920, 1080, 0, 0, 2).then(() => {
                // show HTML Canvas Element in DOM
                this.useCanvasElementForZoom = true
                this.cameraLoading = false
                this.camera = true
            }).catch((error: any) => {
                console.log(error)
            })
          }).catch((error: any) => {
            console.log(error)
          })
        }

    } else if(this.videoSDKProvider === 'twilio') {

      // works for self view
      // createLocalVideoTrack().then((localVideoTrack) => {
      //   const localMediaContainer = document.getElementById('local-media');
      //   localMediaContainer!.appendChild(localVideoTrack.attach());
      // })

      console.log(this.twilioSession.participants)
      console.log(this.twilioSession.participants.values())

      // works for self view and send
      this.twilioVideo.createLocalVideoTrack({
        height: { ideal: 720, min: 480, max: 1080 },
        width:  { ideal: 1280, min: 640, max: 1920 },
        aspectRatio: 16/9,
      }).then((localVideoTrack: any) => {
        this.twilioSession.localParticipant.publishTrack(localVideoTrack);
        const localMediaContainer = document.getElementById('twilio-self-view-div')
        localMediaContainer!.appendChild(localVideoTrack.attach())

        this.cameraLoading = false
        this.camera = true
      });

      // this.twilioSession.localParticipant.videoTracks.forEach((publication: any) => {
      //   publication.enable();
      //   publication.track.start()
      //   publication.publish(publication)
      // })
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
      this.zoomSession.stopVideo()
      this.cameraLoading = false
      this.camera = false
      this.useCanvasElementForZoom = false
      this.useVideoElementForZoom = false
      // stop rendering my own video.
    } else if(this.videoSDKProvider === 'twilio') {

      // createLocalVideoTrack().then((localTrack: any) => {
      //   this.twilioSession.localParticipant.publishTrack(localTrack);
      //   const localMediaContainer = document.getElementById('local-media');
      //   localMediaContainer!.appendChild(localTrack.attach());
      // });

      this.twilioSession.localParticipant.videoTracks.forEach((publication: any) => {
        publication.unpublish();
        publication.track.stop();
        var selfTwilioVideo = document.getElementById('twilio-self-view-div')
        selfTwilioVideo?.querySelector('video')?.remove()
        
        console.log('video stopped')
        this.cameraLoading = false
        this.camera = false
      })

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
    this.useCanvasElementForZoom = false
    this.useVideoElementForZoom = false
    this.activeSpeaker = null

    setTimeout(() => {
      if(this.videoSDKProvider === 'zoom') {
        this.zoomVideo.leave()
        this.sessionLoading = false
        this.session = false
      } else if(this.videoSDKProvider === 'twilio') {
        this.twilioSession.localParticipant.videoTracks.forEach((publication: any) => {
          publication.unpublish();
          publication.track.stop();
          var selfTwilioVideo = document.getElementById('twilio-self-view-div')
          selfTwilioVideo?.querySelector('video')?.remove()
        })
        
        this.twilioSession.localParticipant.audioTracks.forEach((publication: any) => {
          publication.unpublish();
          publication.track.stop();
          document.querySelector('audio')?.remove()
        })

        this.twilioSession.disconnect()

        this.sessionLoading = false
        this.session = false
      } else if(this.videoSDKProvider === 'agora') {
        this.agoraClient.leave()
        this.sessionLoading = false
        this.session = false
      }
    }, 500)

    // destory anything?
  }

}
