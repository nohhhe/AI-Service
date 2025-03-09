'use strict'

import $ from 'jquery'
import 'webpack-jquery-ui/datepicker'
import { todoListTpl, addTpl, editTpl, errTpl } from './templates'

const view = { renderList, renderAddButton, renderEditArea, renderError }
export { view }

// 작업 목록을 렌더링 하는 함수
function renderList (body) {
  $('#content').html(todoListTpl(body.Items))
}

// 작업 추가 버튼을 렌더링 하는 함수
function renderAddButton () {
  $('#edit-area').html(addTpl())
}

// 편집 영역을 렌더링하고 id가 있으면 데이터를 채움
function renderEditArea (id) {
  // 편집 영역을 렌더링
  $('#edit-area').html(editTpl())
  // $('#todo-duedate').datepicker() 없어도 되지 않을까?
  setTimeout(function () {
    $('#todo-duedate').datepicker()
    // id가 있으면 편집 영역을 채움
    if (id) {
      $('#todo-id').val(id)
      $('#todo-duedate').val($('#' + id + ' #due-date').text())
      $('#todo-action').val($('#' + id + ' #action').text())
      // 완료 상태인 경우 체크박스를 체크
      if ($('#' + id + ' #stat').text() === 'done') {
        $('#todo-stat').prop('checked', true)
      }
      $('#todo-note').val($('#' + id + ' #note').text())
    }
  }, 100)
}

// 에러 메시지를 렌더링 하는 함수
function renderError (body) {
  $('#error').html(errTpl(body.err))
}

