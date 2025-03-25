'use strict'

import $ from 'jquery'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'webpack-jquery-ui/css'
import Amplify from 'aws-amplify'
import {todo} from './todo'
import {auth} from './auth'

// oauth 인증 관련 설정
const oauth = {
  domain: process.env.CHAPTER4_COGNITO_DOMAIN, // 코그니토 도메인
  scope: ['email'], // 요청할 권한 범위(이메일 정보)
  redirectSignIn: `https://s3-${process.env.TARGET_REGION}.amazonaws.com/${process.env.CHAPTER4_BUCKET}/index.html`, // 로그인 성공 후 리다이렉트할 URL
  redirectSignOut: `https://s3-${process.env.TARGET_REGION}.amazonaws.com/${process.env.CHAPTER4_BUCKET}/index.html`, // 로그아웃 후 리다이렉트할 URL
  responseType: 'token' // 인증 응답 유형
}

// Amplify 인증 설정
Amplify.configure({
  Auth: {
    region: process.env.TARGET_REGION,
    userPoolId: process.env.CHAPTER4_POOL_ID, // 사용자 풀 ID
    userPoolWebClientId: process.env.CHAPTER4_POOL_CLIENT_ID, // 사용자 풀 클라이언트 ID
    identityPoolId: process.env.CHAPTER4_IDPOOL, // identity 풀 ID
    mandatorySignIn: false, // 필수 로그인 여부
    oauth: oauth // oauth 설정 적용
  },
  Storage: {
    bucket: process.env.CHAPTER4_DATA_BUCKET,
    region: process.env.TARGET_REGION,
    identityPoolId: process.env.CHAPTER4_IDPOOL,
    level: 'public'
  }
})


$(function () {
  auth.activate().then((user) => {
    if (user) {
      todo.activate(auth)
    }
  })
})

