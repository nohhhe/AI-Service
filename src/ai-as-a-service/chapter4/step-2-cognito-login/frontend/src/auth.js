'use strict'

import $ from 'jquery'
import {view} from './auth-view'
import {Auth} from 'aws-amplify'

const auth = {activate, user, session}
export {auth, user}

// 로그인/로그아웃 버튼 이벤트 바인딩
function bindLinks () {
  $('#logout').unbind('click')
  $('#logout').on('click', e => {
    // 로그아웃 처리
    Auth.signOut().catch(() => {})
  })

  $('#login').unbind('click')
  $('#login').on('click', e => {
    // 앰플리파이 인증 설정 가져오기
    const config = Auth.configure()
    console.log(config)
    // oauth 인증 관련 설정 가져오기
    const { domain, redirectSignIn, responseType } = config.oauth
    const clientId = config.userPoolWebClientId
    const url = 'https://' + domain + '/login?redirect_uri=' + redirectSignIn + '&response_type=' + responseType + '&client_id=' + clientId
    // 로그인 페이지로 이동
    window.location.assign(url)
  })
}

// 사용자 정보 가져오기
function user () {
  // 앰플리파이에서 코그니토 유저 풀을 사용하여 사용자 정보 가져오기
  return Auth.currentAuthenticatedUser()
}

// 세션 정보 가져오기
function session () {
  // 앰플리파이에서 코그니토 유저 풀을 사용하여 세션 정보 가져오기
  return Auth.currentSession()
}

// 초기화 및 로그인 상태 확인
function activate () {
  return new Promise((resolve, reject) => {
    Auth.currentAuthenticatedUser()
      .then(user => {
        // 로그인/로그아웃 버튼 렌더링
        view.renderLink(true)
        // 로그인/로그아웃 버튼 이벤트 바인딩
        bindLinks()
        // 사용자 정보 반환
        resolve(user)
      })
      .catch(() => {
        view.renderLink(false)
        bindLinks()
        resolve(null)
      })
  })
}

