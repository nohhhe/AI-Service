/* globals alert:false */
'use strict'

import $ from 'jquery'
import {Storage} from 'aws-amplify'
import {AudioControl} from './audio/control'
import uuid from 'uuid/v1'
import {view} from './note-view'

const note = {activate, bindRecord}
export {note}

const API_ROOT = `https://chapter4api.${process.env.CHAPTER4_DOMAIN}/noteapi/note/`
const DATA_BUCKET_ROOT = `https://s3-${process.env.TARGET_REGION}.amazonaws.com/${process.env.CHAPTER4_DATA_BUCKET}/public/`

let auth
let ac
let itv

// 3초마다 폴링하여 결과를 출력
function pollNote (noteId) {
  let count = 0
  itv = setInterval(() => {
    auth.session().then(session => {
      $.ajax(API_ROOT + noteId, {
        type: 'GET',
        headers: {
          Authorization: session.idToken.jwtToken
        },
        success: function (body) {
          if (body.transcribeStatus === 'COMPLETED') {
            clearInterval(itv)
            // 오디오 변환 결과 출력
            view.renderNote(body.results.transcripts[0].transcript)
          } else if (body.transcribeStatus === 'FAILED') {
            clearInterval(itv)
            view.renderNote('FAILED')
          } else {
            count++
            let dots = ''
            for (let idx = 0; idx < count; idx++) {
              dots = dots + '.'
            }
            // 진행 중인 상태 출력
            view.renderNote('Still thinking' + dots)
          }
        }
      })
    }).catch(err => view.renderError(err))
  }, 3000)
}

// 녹음된 오디오 데이터를 서버로 전송
function submitNote (noteId, recordedSampleRate) {
  // 서버로 전송할 데이터
  const body = {
    noteLang: 'en-US',
    noteUri: DATA_BUCKET_ROOT + noteId + '.wav',
    noteFormat: 'wav',
    noteName: noteId,
    noteSampleRate: recordedSampleRate
  }

  // 세션을 획득
  auth.session().then(session => {
    $.ajax(API_ROOT, {
      data: JSON.stringify(body),
      contentType: 'application/json',
      type: 'POST',
      headers: {
        Authorization: session.idToken.jwtToken
      },
      success: function (body) {
        if (body.stat === 'ok') {
          // 노트 상태 폴링
          pollNote(noteId)
        } else {
          $('#error').html(body.err)
        }
      }
    })
  }).catch(err => view.renderError(err))
}

// 녹음 시작하는 함수
function startRecord () {
  // 녹음 시작 시 노트 영역에 Speak 출력
  view.renderNote('Speak')

  // 오디오 녹음을 제어하는 객체 생성
  ac = AudioControl({checkAudioSupport: false})

  // 오디오 지원 여부 확인
  ac.supportsAudio((supported) => {
    if (supported) {
      // 녹음 시작
      ac.startRecording()
    } else {
      alert('No audio support!')
    }
  })
}

// 녹음 중지하는 함수
function stopRecord () {
  // uuid 라이브러리를 통해 noteId 생성
  const noteId = uuid()

  // 녹음 중지 시 노트 영역에 Thinking 출력
  view.renderNote('Thinking')
  // 녹음 중지
  ac.stopRecording()

  // 녹음된 오디오 데이터를 WAV 파일로 변환
  ac.exportWAV((blob, recordedSampleRate) => {
    // WAV 파일을 S3에 업로드
    Storage.put(noteId + '.wav', blob)
      .then(result => {
        // 녹음된 오디오 데이터를 서버로 전송
        submitNote(noteId, recordedSampleRate)
      })
      .catch(err => {
        console.log(err)
      })
    // 오디오 객체 종료
    ac.close()
  })
}

// 녹음 버튼 이벤트 바인딩
function bindRecord () {
  $('#todo-note-start').unbind('click')
  $('#todo-note-start').on('click', e => {
    // 녹음 시작
    startRecord()
  })

  $('#todo-note-stop').unbind('click')
  $('#todo-note-stop').on('click', e => {
    // 녹음 중지
    stopRecord()
  })
}

function activate (authObj) {
  auth = authObj
}

