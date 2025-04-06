'use strict'

import $ from 'jquery'
import {view} from './schedule-view'

const schedule = {activate}
export {schedule}

const API_ROOT = `https://chapter4api.${process.env.CHAPTER4_DOMAIN}/schedule/day/`
let itv
let auth

// 스케줄링된 파일을 재생하는 함수
function playSchedule (url) {
  let audio = document.createElement('audio')
  audio.src = url
  audio.play()
}

// 스케줄 상태를 폴링하는 함수
function pollSchedule (taskId) {
  itv = setInterval(() => {
    auth.session().then(session => {
      $.ajax(API_ROOT + taskId, {
        contentType: 'application/json',
        type: 'GET',
        headers: {
          Authorization: session.idToken.jwtToken
        },
        success: function (body) {
          if (body.taskStatus === 'completed') {
            clearInterval(itv)
            playSchedule(body.signedUrl)
          }
          if (body.taskStatus === 'failed') {
            clearInterval(itv)
            $('#error').innerHTML = 'ERROR: ' + body.err
          }
        }
      })
    }).catch(err => view.renderError(err))
  }, 3000)
}

// 스케줄 변환을 요청하는 함수
function buildSchedule (date) {
  const body = {
    date: date
  }

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
          pollSchedule(body.taskId)
        } else {
          $('#error').innerHTML = body.err
        }
      }
    })
  }).catch(err => view.renderError(err))
}

// 이벤트 핸들러를 바인딩하는 함수
function bindButton () {
  $('#todo-schedule').unbind('click')
  $('#todo-schedule').on('click', e => {
    buildSchedule()
  })
}

// 초기화 함수
function activate (authObj) {
  auth = authObj
  view.renderScheduleButton()
  bindButton()
}

