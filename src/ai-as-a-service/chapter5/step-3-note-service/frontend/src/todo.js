'use strict'

import $ from 'jquery'
import {view} from './todo-view'
import {note} from './note'

const todo = {activate}
export {todo}

const API_ROOT = `https://chapter4api.${process.env.CHAPTER4_DOMAIN}/api/todo/`

let auth

// 사용자 입력을 수집하여 객체로 반환
function gather () {
  return {
    id: $('#todo-id').val(),
    dueDate: $('#todo-duedate').val(),
    action: $('#todo-action').val(),
    stat: $('#todo-stat').is(':checked') ? 'done' : 'open',
    note: $('#todo-note').val()
  }
}

// 새로운 작업을 생성
function create (cb) {
  // 세션을 획득
  auth.session().then(session => {
    $.ajax(API_ROOT, {
      data: JSON.stringify(gather()),
      contentType: 'application/json',
      type: 'POST',
      headers: {
        // 세션 토큰을 헤더에 추가
        Authorization: session.idToken.jwtToken
      },
      success: function (body) {
        if (body.stat === 'ok') {
          // 작업 목록을 다시 불러옴
          list(cb)
        } else {
          $('#error').html(body.err)
          cb && cb()
        }
      }
    })
  }).catch(err => view.renderError(err))
}

// 작업을 업데이트
function update (cb) {
  auth.session().then(session => {
    $.ajax(API_ROOT + $('#todo-id').val(), {
      data: JSON.stringify(gather()),
      contentType: 'application/json',
      type: 'PUT',
      headers: {
        Authorization: session.idToken.jwtToken
      },
      success: function (body) {
        if (body.stat === 'ok') {
          list(cb)
        } else {
          $('#error').html(body.err)
          cb && cb()
        }
      }
    })
  }).catch(err => view.renderError(err))
}

// 작업을 삭제
function del (id) {
  auth.session().then(session => {
    $.ajax(API_ROOT + id, {
      type: 'DELETE',
      headers: {
        Authorization: session.idToken.jwtToken
      },
      success: function (body) {
        if (body.stat === 'ok') {
          list()
        } else {
          $('#error').html(body.err)
        }
      }
    })
  }).catch(err => view.renderError(err))
}

// 작업 목록을 불러옴
function list (cb) {
  auth.session().then(session => {
    $.ajax(API_ROOT, {
      type: 'GET',
      headers: {
        Authorization: session.idToken.jwtToken
      },
      success: function (body) {
        if (body.stat === 'ok') {
          view.renderList(body)
        } else {
          view.renderError(body)
        }
        cb && cb()
      }
    })
  }).catch(err => view.renderError(err))
}

// 리스트 관련 이벤트 핸들러를 바인딩
function bindList () {
  $('.todo-item-edit').unbind('click')
  $('.todo-item-edit').on('click', (e) => {
    // 편집 영역을 렌더링하고 데이터를 채움
    view.renderEditArea(e.currentTarget.id)
  })
  $('.todo-item-delete').unbind('click')
  $('.todo-item-delete').on('click', (e) => {
    del(e.currentTarget.id)
  })
}

// 편집 관련 이벤트 핸들러를 바인딩
function bindEdit () {
  // 새로운 작업 생성 이벤트 바인딩
  $('#input-todo').unbind('click')
  $('#input-todo').on('click', e => {
    e.preventDefault()
    // 편집 영역을 렌더링
    view.renderEditArea()
  })

  // 저장 이벤트 바인딩
  $('#todo-save').unbind('click')
  $('#todo-save').on('click', e => {
    e.preventDefault()
    if ($('#todo-id').val().length > 0) {
      // 작업을 업데이트
      update(() => {
        view.renderAddButton()
      })
    } else {
      // 새로운 작업을 생성
      create(() => {
        view.renderAddButton()
      })
    }
  })

  // 취소 이벤트 바인딩
  $('#todo-cancel').unbind('click')
  $('#todo-cancel').on('click', e => {
    e.preventDefault()
    view.renderAddButton()
  })

  // 녹음 이벤트 바인딩
  note.bindRecord()
}

// 초기화 함수
function activate (authObj) {
  auth = authObj
  note.activate(authObj)
  list(() => {
    bindList()
    bindEdit()
  })
  $('#content').bind('DOMSubtreeModified', () => {
    bindList()
    bindEdit()
  })
}

