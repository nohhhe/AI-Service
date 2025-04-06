/* globals AudioContext:false Worker:false */
'use strict'

export {AudioRecorder}

// 오디오 녹음을 제어하는 객체
function Recorder (source, silenceDetectionConfig) {
  // 워커 객체 생성
  let worker = new Worker('./worker.js')

  silenceDetectionConfig = silenceDetectionConfig || {}
  silenceDetectionConfig.time = silenceDetectionConfig.hasOwnProperty('time') ? silenceDetectionConfig.time : 1500 // 무음 시간
  silenceDetectionConfig.amplitude = silenceDetectionConfig.hasOwnProperty('amplitude') ? silenceDetectionConfig.amplitude : 0.2 // 무음 진폭

  let recording = false
  let currCallback
  let start
  let silenceCallback // 무음 콜백 함수
  let visualizationCallback // 시각화 콜백 함수
  let node = source.context.createScriptProcessor(4096, 1, 1) // 오디오 녹음을 위한 노드 생성

  // 워커로부터 메시지를 받아 처리
  worker.onmessage = function (message) {
    let blob = message.data
    currCallback(blob, source.context.sampleRate)
  }

  // 워커 초기화
  worker.postMessage({
    command: 'init',
    config: {
      sampleRate: source.context.sampleRate
    }
  })

  // 녹음 시작
  function record (onSilence, visualizer) {
    silenceCallback = onSilence // 무음 콜백 함수
    visualizationCallback = visualizer // 시각화 콜백 함수
    start = Date.now() // 녹음 시작 시간
    recording = true // 녹음 상태로 변경
  }

  // 녹음 중지
  function stop () {
    recording = false
  }

  // 녹음된 데이터 초기화
  function clear () {
    stop()
    worker.postMessage({command: 'clear'})
  }

  // 녹음된 오디오 데이터를 WAV 파일로 변환
  function exportWAV (callback, sampleRate) {
    currCallback = callback
    worker.postMessage({
      command: 'export',
      sampleRate: sampleRate
    })
  }

  // 실시간 오디오 감지와 무음 감지 콜백 처리
  function analyse () {
    analyser.fftSize = 2048
    let bufferLength = analyser.fftSize
    let dataArray = new Uint8Array(bufferLength)
    let amplitude = silenceDetectionConfig.amplitude
    let time = silenceDetectionConfig.time

    analyser.getByteTimeDomainData(dataArray)

    if (typeof visualizationCallback === 'function') {
      visualizationCallback(dataArray, bufferLength)
    }

    for (let i = 0; i < bufferLength; i++) {
      let currValueTime = (dataArray[i] / 128) - 1.0
      if (currValueTime > amplitude || currValueTime < (-1 * amplitude)) {
        start = Date.now()
      }
    }
    let newtime = Date.now()
    let elapsedTime = newtime - start
    if (elapsedTime > time) {
      silenceCallback()
    }
  }

  // 녹음 객체 종료
  function close () {
    worker.postMessage({command: 'close'})
  }


  // 노드에 오디오 처리 이벤트 추가 (녹음을 할 때 마다 자동으로 호출)
  node.onaudioprocess = function (audioProcessingEvent) {
    if (!recording) {
      return
    }

    // 녹음 중인 오디오 데이터를 워커로 전달
    worker.postMessage({
      command: 'record',
      buffer: [ audioProcessingEvent.inputBuffer.getChannelData(0) ]
    })

    // 녹음 중인 오디오 데이터를 분석
    analyse()
  }

  // 오디오 분석을 위한 객체 생성
  let analyser = source.context.createAnalyser()
  analyser.minDecibels = -90
  analyser.maxDecibels = -10
  analyser.smoothingTimeConstant = 0.85

  // 노드에 오디오 분석 객체 연결
  source.connect(analyser)
  // 노드에 오디오 녹음 객체 연결
  analyser.connect(node)
  // 노드에 오디오 출력 연결
  node.connect(source.context.destination)

  return {
    record,
    stop,
    clear,
    close,
    exportWAV
  }
}


// 오디오 녹음을 위한 객체
function AudioRecorder () {
  let audioCtx
  let audioStream
  let rec

  // 브라우저에서 오디오 권한을 요청하고 스트림을 생성
  function requestDevice () {
    // 오디오 컨텍스트가 없으면 생성
    if (typeof audioCtx === 'undefined') {
      window.AudioContext = window.AudioContext || window.webkitAudioContext
      audioCtx = new AudioContext() // 브라우저에서 제공되는 표준 오디오 API
    }

    // 브라우저에 오디오 권한을 요청하고 스트림을 생성하여 저장
    return navigator.mediaDevices.getUserMedia({audio: true}).then(function (stream) {
      audioStream = stream
    })
  }

  // 오디오 녹음을 제어하는 객체 생성
  function createRecorder (silenceDetectionConfig) {
    // 오디오 스트림을 이용하여 녹음 객체 생성
    rec = Recorder(audioCtx.createMediaStreamSource(audioStream), silenceDetectionConfig)
    return rec
  }


  function audioContext () {
    return audioCtx
  }

  // 오디오 녹음 객체 종료
  function close () {
    rec.close() // 녹음 객체 종료
    audioCtx.close() // 오디오 컨텍스트 종료
  }


  return {
    requestDevice,
    createRecorder,
    audioContext,
    close
  }
}

