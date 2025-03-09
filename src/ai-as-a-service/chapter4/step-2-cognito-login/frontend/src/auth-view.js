'use strict'

import $ from 'jquery'
import { navBarTpl } from './templates'

const view = { renderLink }
export { view }

// 로그인/로그아웃 버튼 렌더링
function renderLink (isAuth) {
  $('#navbarNav').html(navBarTpl(isAuth))
}

