'use strict'

import {AudioRecorder} from './recorder.js'

export {AudioControl}

// 오디오 녹음 및 재생을 제어하는 객체
function AudioControl (options) {
  let recorder
  let audioRecorder
  let checkAudioSupport
  let audioSupported
  let playbackSource
  let UNSUPPORTED = 'Audio is not supported.'
  options = options || {}
  // 오디오 지원 여부를 확인하는 옵션
  checkAudioSupport = options.checkAudioSupport !== false

  // 녹음 시작
  function startRecording (onSilence, visualizer, silenceDetectionConfig) {
    onSilence = onSilence || function () {}
    visualizer = visualizer || function () {}
    audioSupported = audioSupported !== false
    if (!audioSupported) {
      throw new Error(UNSUPPORTED)
    }

    // 오디오 녹음을 위한 객체 생성
    recorder = audioRecorder.createRecorder(silenceDetectionConfig)
    // 녹음 시작
    recorder.record(onSilence, visualizer)
  }

  // 녹음 중지
  function stopRecording () {
    audioSupported = audioSupported !== false
    if (!audioSupported) {
      throw new Error(UNSUPPORTED)
    }
    // 녹음 중지
    recorder.stop()
  }

  // 녹음된 오디오 데이터를 WAV 파일로 변환
  function exportWAV (callback, sampleRate) {
    audioSupported = audioSupported !== false
    if (!audioSupported) {
      throw new Error(UNSUPPORTED)
    }
    if (!(callback && typeof callback === 'function')) {
      throw new Error('You must pass a callback function to export.')
    }
    sampleRate = (typeof sampleRate !== 'undefined') ? sampleRate : 16000

    // WAV 파일로 변환
    recorder.exportWAV(callback, sampleRate)
    // 녹음된 데이터 초기화
    recorder.clear()
  }

  function playHtmlAudioElement (buffer, callback) {
    if (typeof buffer === 'undefined') {
      return
    }
    var myBlob = new Blob([buffer])
    var audio = document.createElement('audio')
    var objectUrl = window.URL.createObjectURL(myBlob)
    audio.src = objectUrl
    audio.addEventListener('ended', function () {
      audio.currentTime = 0
      if (typeof callback === 'function') {
        callback()
      }
    })
    audio.play()
  }

  function play (buffer, callback) {
    if (typeof buffer === 'undefined') {
      return
    }
    var myBlob = new Blob([buffer])
    // We'll use a FileReader to create and ArrayBuffer out of the audio response.
    var fileReader = new FileReader()
    fileReader.onload = function() {
      // Once we have an ArrayBuffer we can create our BufferSource and decode the result as an AudioBuffer.
      playbackSource = audioRecorder.audioContext().createBufferSource()
      audioRecorder.audioContext().decodeAudioData(this.result, function(buf) {
        // Set the source buffer as our new AudioBuffer.
        playbackSource.buffer = buf
        // Set the destination (the actual audio-rendering device--your device's speakers).
        playbackSource.connect(audioRecorder.audioContext().destination)
        // Add an "on ended" callback.
        playbackSource.onended = function(event) {
          if (typeof callback === 'function') {
            callback()
          }
        }
        // Start the playback.
        playbackSource.start(0)
      })
    }
    fileReader.readAsArrayBuffer(myBlob)
  }

  function stop () {
    if (typeof playbackSource === 'undefined') {
      return
    }
    playbackSource.stop()
  }

  function clear () {
    recorder.clear()
  }

  // 오디오 지원 여부 확인
  function supportsAudio (callback) {
    callback = callback || function () { }
    // 브라우저에서 오디오 지원 여부 확인
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // 오디오 녹음을 위한 객체 생성
      audioRecorder = AudioRecorder()
      // 브라우저에서 오디오 권한을 요청하고 스트림을 생성
      audioRecorder.requestDevice()
        .then((stream) => {
          audioSupported = true
          callback(audioSupported)
        })
        .catch(() => {
          audioSupported = false
          callback(audioSupported)
        })
    } else {
      audioSupported = false
      callback(audioSupported)
    }
  }

  // 오디오 녹음 객체 종료
  function close () {
    audioRecorder.close()
  }

  if (checkAudioSupport) {
    supportsAudio()
  }

  return {
    startRecording,
    stopRecording,
    exportWAV,
    play,
    stop,
    clear,
    playHtmlAudioElement,
    supportsAudio,
    close
  }
}

