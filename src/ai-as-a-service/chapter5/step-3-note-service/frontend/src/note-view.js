'use strict'

import $ from 'jquery'

const view = { renderNote }
export { view }

// 노트 영역에 텍스트를 출력
function renderNote (text) {
  $('#todo-note').text(text)
}
