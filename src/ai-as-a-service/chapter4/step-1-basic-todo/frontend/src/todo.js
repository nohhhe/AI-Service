'use strict'

import $ from 'jquery'
import {view} from './todo-view'

const todo = {activate}
export {todo}

const API_ROOT = `https://chapter4api.${process.env.CHAPTER4_DOMAIN}/api/todo/`

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
  $.ajax(API_ROOT, {
    data: JSON.stringify(gather()),
    contentType: 'application/json',
    type: 'POST',
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
}

// 작업을 업데이트
function update (cb) {
  $.ajax(API_ROOT + $('#todo-id').val(), {
    data: JSON.stringify(gather()),
    contentType: 'application/json',
    type: 'PUT',
    success: function (body) {
      if (body.stat === 'ok') {
        list(cb)
      } else {
        $('#error').html(body.err)
        cb && cb()
      }
    }
  })
}

// 작업을 삭제
function del (id) {
  $.ajax(API_ROOT + id, {
    type: 'DELETE',
    success: function (body) {
      if (body.stat === 'ok') {
        list()
      } else {
        $('#error').html(body.err)
      }
    }
  })
}

// 작업 목록을 불러옴
function list (cb) {
  $.get(API_ROOT, function (body) {
    if (body.stat === 'ok') {
      // 작업 목록을 렌더링
      view.renderList(body)
    } else {
      // 에러 메시지를 렌더링
      view.renderError(body)
    }
    cb && cb()
  })
}

// 리스트 관련 이벤트 핸들러를 바인딩
function bindList () {
  // 편집 이벤트 바인딩
  $('.todo-item-edit').unbind('click')
  $('.todo-item-edit').on('click', (e) => {
    // 편집 영역을 렌더링하고 데이터를 채움
    view.renderEditArea(e.currentTarget.id)
  })

  // 삭제 이벤트 바인딩
  $('.todo-item-delete').unbind('click')
  $('.todo-item-delete').on('click', (e) => {
    // 작업을 삭제
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
}

// 초기화 함수
function activate () {
  // 작업 목록 및 리스트, 편집 관련 이벤트를 바인딩
  list(() => {
    bindList()
    bindEdit()
  })

  // content 하위 DOM 변경 시 이벤트 재 바인딩
  $('#content').bind('DOMSubtreeModified', () => {
    bindList()
    bindEdit()
  })
}

