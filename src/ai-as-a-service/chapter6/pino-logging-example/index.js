'use strict'

const pino = require('pino')

// 로그 소스를 식별하기 위해 특정 이름을 지정된다.
const log = pino({ name: 'pino-logging-example' })

// 정보 메시지가 일부 데이터와 함께 기록된다. 데이터는 첫 번째 인수의 객체로 전달된다.
log.info({ a: 1, b: 2 }, 'Hello world')

// error 속성을 사용하여 오류가 기록된다. 오류가 객체로 직렬화되는 특수 속성으로 객체에는 오류 유형과 스택 추적이 문자열로 포함된다.
const err = new Error('Something failed')
log.error({ err })
