/* globals alert:false */
'use strict'

import $ from 'jquery'
import { LexRuntimeV2Client, RecognizeTextCommand, RecognizeUtteranceCommand } from '@aws-sdk/client-lex-runtime-v2'
import { AudioControl } from './audio/control'
import moment from 'moment'
import { view } from './bot-view'

const bot = { activate }
export { bot }

let ac
let auth
let todo
let lexClient
let lexUserId = 'chatbot-demo-' + Date.now()
let sessionId = lexUserId

// Lex V2 관련 상수들
const REGION = process.env.TARGET_REGION
const BOT_ID = process.env.BOT_ID
const BOT_ALIAS_ID = process.env.BOT_ALIAS_ID
const LOCALE_ID = process.env.LOCALE_ID

let recording = false

// lex v2에 메시지를 전송하는 함수
async function pushChat () {
  const chatInput = document.getElementById('chat-input')

  if (chatInput && chatInput.value && chatInput.value.trim().length > 0) {
    const input = chatInput.value.trim()
    chatInput.value = '...'
    chatInput.locked = true

    // lex v2에 보낼 객체 생성
    const command = new RecognizeTextCommand({
      botId: BOT_ID,
      botAliasId: BOT_ALIAS_ID,
      localeId: LOCALE_ID,
      sessionId: sessionId,
      text: input
    })

    // 입력한 메시지를 화면에 보여줌
    view.showRequest(input)

    try {
      // lex에 메시지를 전송
      const response = await lexClient.send(command)

      // lex가 처리 가능한 상태 (정보 수집 완료 및 응답 준비 완료)
      if (response.sessionState?.intent?.state === 'ReadyForFulfillment') {
        // 슬롯 값을 가져옴
        const slots = response.sessionState.intent.slots
        // 슬롯 값을 활용하여 할 일 객체를 생성
        todo.createTodo({
          id: '',
          note: '',
          dueDate: moment(slots.dueDate.value.interpretedValue).format('MM/DD/YYYY'),
          action: slots.action.value.interpretedValue,
          stat: 'open'
        }, function () { })
      }

      // lex의 응답을 화면에 보여줌
      view.showResponse(response)
    } catch (err) {
      console.error('Error:', err)
      view.showError('Error: ' + err.message)
    }

    chatInput.value = ''
    chatInput.locked = false
  }

  return false
}

// 음성 응답을 재생하는 함수
function playResponse (buffer, cb) {
  const blob = new Blob([buffer], { type: 'audio/mpeg' })
  const audio = document.createElement('audio')
  const objectUrl = window.URL.createObjectURL(blob)

  audio.src = objectUrl
  audio.addEventListener('ended', function () {
    audio.currentTime = 0
    cb && cb()
  })
  audio.play()
}

// 음성 인식 결과를 lex에 전송하고 응답을 받는 함수
async function pushVoice (blob) {
  const chatInput = document.getElementById('chat-input')

  // lex v2에 음성을 전송하기 위한 객체 생성
  const command = new RecognizeUtteranceCommand({
    botId: BOT_ID,
    botAliasId: BOT_ALIAS_ID,
    localeId: LOCALE_ID,
    sessionId: sessionId,
    requestContentType: 'audio/l16; rate=16000; channels=1',
    responseContentType: 'audio/mpeg',
    inputStream: blob
  })

  try {
    const response = await lexClient.send(command)
    const audioStream = response.audioStream

    if (audioStream) {
      // 음성 응답을 재생
      playResponse(audioStream, () => { })
    }

    const sessionState = JSON.parse(new TextDecoder().decode(response.sessionState))
    const intent = sessionState.intent

    // lex가 처리 가능한 상태 (정보 수집 완료 및 응답 준비 완료)
    if (intent?.state === 'ReadyForFulfillment') {
      const slots = intent.slots
      todo.createTodo({
        id: '',
        note: '',
        dueDate: moment(slots.dueDate.value.interpretedValue).format('MM/DD/YYYY'),
        action: slots.action.value.interpretedValue,
        stat: 'open'
      }, function () { })
    }

    view.showResponse(sessionState)

  } catch (err) {
    console.error('Error:', err)
    view.showError('Error: ' + err.message)
  }

  chatInput.value = ''
  chatInput.locked = false

  return false
}

// 음성 녹음을 시작하는 함수
function startRecord () {
  ac = AudioControl({ checkAudioSupport: false })
  ac.supportsAudio((supported) => {
    if (supported) {
      ac.startRecording()
    } else {
      alert('No audio support!')
    }
  })
}

// 음성 녹음을 종료하는 함수
function stopRecord () {
  ac.stopRecording()
  ac.exportWAV((blob, recordedSampleRate) => {
    pushVoice(blob)
    ac.close()
  })
}

// 마이크로폰 버튼에 이벤트 핸들러를 바인딩하는 함수
function bindRecord () {
  $('#microphone').unbind('click')
  $('#microphone').on('click', e => {
    if (!recording) {
      recording = true
      $('#microphone').html('<img src="assets/images/micon.png" width="20px" alt="mic" class="float-left">')
      // 녹음 시작
      startRecord()
    } else {
      recording = false
      $('#microphone').html('<img src="assets/images/micoff.png" width="20px" alt="mic" class="float-left">')
      // 녹음 종료
      stopRecord()
    }
  })
}

// 초기화 함수
function activate (authObj, todoObj) {
  auth = authObj
  todo = todoObj

  // AWS 인증 객체에서 자격 증명을 얻는 함수
  auth.credentials().then(creds => {
    // AWS SDK를 사용하여 Lex V2 클라이언트를 생성합니다.
    lexClient = new LexRuntimeV2Client({
      region: REGION,
      credentials: creds
    })

    $('#chat-input').keypress(function (e) {
      if (e.which === 13) {
        pushChat()
        e.preventDefault()
        return false
      }
    })

    bindRecord()
  })
}
