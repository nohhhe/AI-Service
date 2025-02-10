'use strict'

const request = require('request')
const urlParser = require('url')
const URLSearchParams = require('url').URLSearchParams
const shortid = require('shortid') // 고유한 짧은 랜덤 문자열(Unique ID)을 생성하는 패키지
const asnc = require('async')
const AWS = require('aws-sdk') // AWS SDK 모듈 로딩
const s3 = new AWS.S3() // S3 인터페이스 생성
const sqs = new AWS.SQS({region: process.env.REGION}) // SQS 인터페이스 생성
const images = require('./images')()

// 크롤링한 이미지의 상태 정보를 AWS S3에 JSON 파일로 저장하는 함수
function writeStatus (url, domain, results) {
  let parsed = urlParser.parse(url)
  parsed.hostname = domain
  parsed.host = domain

  // 상태 파일 생성
  const statFile = {
    url: urlParser.format(parsed),
    stat: 'downloaded',
    downloadResults: results
  }

  // S3에 상태 파일을 업로드
  return new Promise((resolve) => {
    s3.putObject({Bucket: process.env.BUCKET, Key: domain + '/status.json', Body: Buffer.from(JSON.stringify(statFile, null, 2), 'utf8')}, (err, data) => {
      resolve({stat: err || 'ok'})
    })
  })
}

// 도메인을 생성하는 함수
function createUniqueDomain (url) {
  const parsed = urlParser.parse(url)
  const sp = new URLSearchParams(parsed.search)
  let domain

  if (sp.get('q')) {
    // 도메인 앞에 쿼리 문자열 추가
    domain = sp.get('q') + '.' + parsed.hostname
  } else {
    // 도메인 앞에 랜덤 문자열 추가
    domain = shortid.generate() + '.' + parsed.hostname
  }
  domain = domain.replace(/ /g, '')
  return domain.toLowerCase()
}

// 크롤링 함수
function crawl (domain, url, context) {
  console.log('crawling: ' + url)
  return new Promise(resolve => {
    // HTTP 요청을 보내고 웹 페이지(HTML)를 가져온다.
    request(url, (err, response, body) => {
      if (err || response.statusCode !== 200) {
        console.log('error: ' + err)
        return resolve({statusCode: 500, body: err})
      }
      console.log('request successful')

      // <img> 태그에서 이미지 URL을 추출하는 함수
      images.parseImageUrls(body, url)
        .then(urls => {
          // 이미지 개수 로그 출력
          console.log('found ' + urls.length + ' images')
          // 최대 10개의 이미지만 선택 (S3 사용량 제한)
          const limitedUrls = urls.slice(0, 10)

          // 추출된 이미지 URL을 다운로드하는 함수
          images.fetchImages(limitedUrls, domain).then(results => {
            // 다운로드한 이미지 상태를 S3에 저장하는 함수
            writeStatus(url, domain, results).then(result => {
              resolve({statusCode: 200, body: JSON.stringify(result)})
            })
          })
        })
        .catch(err => {
            console.log('error: ' + err)
            resolve({statusCode: 500, body: err})
        })
    })
  })
}

// 분석 큐에 메시지를 전송하는 함수
function queueAnalysis (domain, url, context) {
  let accountId = process.env.ACCOUNTID

  // AWS 계정 ID를 찾을 수 없는 경우, ARN에서 추출
  if (!accountId) {
    accountId = context.invokedFunctionArn.split(':')[4]
  }
  let queueUrl = `https://sqs.${process.env.REGION}.amazonaws.com/${accountId}/${process.env.ANALYSIS_QUEUE}`

  // 분석 큐에 보낼 메시지 생성
  let params = {
    MessageBody: JSON.stringify({action: 'analyze', msg: {domain: domain}}),
    QueueUrl: queueUrl
  }

  // SQS에 메시지 전송
  return new Promise(resolve => {
    sqs.sendMessage(params, (err, data) => {
      if (err) { console.log('QUEUE ERROR: ' + err); return resolve({statusCode: 500, body: err}) }
      console.log('queued analysis: ' + queueUrl)
      resolve({statusCode: 200, body: {queue: queueUrl, msgId: data.MessageId}})
    })
  })
}

/* 크롤러 서비스의 진입점
 * event: 처리 중인 현재 이벤트에 대한 정보를 제공한다. 객체가 SQS 큐에서 가져온 레코드 배열을 보유한다.
 * context: 호출에 대한 정보를 제공하기 위하여 AWS에서 사용하는 인수로, 사용 가능한 메모리, 실행 시간, 클라이언트 호출 컨텍스트 등의 정보를 담는다.
 * cb: 콜백 함수, 처리가 완료되면 핸들러가 결과와 함께 이 함수를 호출한다.
 */
module.exports.crawlImages = function (event, context, cb) {
  // 메시지를 기준으로 반복 처리
  asnc.eachSeries(event.Records, (record, asnCb) => {
    let { body } = record

    try {
      body = JSON.parse(body)
    } catch (exp) {
      return asnCb('message parse error: ' + record)
    }

    // 메시지 유형 확인 및 유효성 검사
    if (body.action === 'download' && body.msg && body.msg.url) {
      // 도메인 생성
      const udomain = createUniqueDomain(body.msg.url)
      // 크롤링 함수 호출
      crawl(udomain, body.msg.url, context).then(result => {
        // 분석 큐에 메시지를 전송하는 함수 호출
        queueAnalysis(udomain, body.msg.url, context).then(result => {
          asnCb(null, result)
        })
      })
    } else {
      asnCb('malformed message')
    }
  }, (err) => {
    if (err) { console.log(err) }
    cb()
  })
}
