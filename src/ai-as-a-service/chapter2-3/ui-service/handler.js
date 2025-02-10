'use strict'

const urlParser = require('url')
const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const sqs = new AWS.SQS({region: process.env.REGION})


function readStatus (folder) {
  const params = {
    Bucket: process.env.BUCKET,
    Key: folder + 'status.json'
  }
  console.log(JSON.stringify(params, null, 2))
  return new Promise((resolve) => {
    s3.getObject(params, (err, data) => {
      if (err) { return resolve({stat: err}) }
      let statFile = JSON.parse(data.Body.toString())
      resolve(statFile)
    })
  })
}


function respond (code, body, cb) {
  const response = {
    statusCode: code,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(body)
  }
  console.log(JSON.stringify(response))
  cb(null, response)
}

// API 게이트웨이로 요청을 받으면 URL을 추출하여 크롤러 큐로 보내는 함수
module.exports.analyzeUrl = (event, context, cb) => {
  let accountId = process.env.ACCOUNTID
  // 환경 변수에 계정 ID가 없으면 ARN에서 추출
  if (!accountId) {
    accountId = context.invokedFunctionArn.split(':')[4]
  }
  const queueUrl = `https://sqs.${process.env.REGION}.amazonaws.com/${accountId}/${process.env.QUEUE}`
  const body = JSON.parse(event.body)

  // SQS 보낼 메시지 구성
  const params = {
    MessageBody: JSON.stringify({action: 'download', msg: body}),
    QueueUrl: queueUrl
  }

  console.log(JSON.stringify(params, null, 2))

  // SQS에 메시지 전송
  sqs.sendMessage(params, (err, data) => {
    if (err) { return respond(500, {stat: 'error', details: err}, cb) }
    respond(200, {stat: 'ok', details: {queue: queueUrl, msgId: data.MessageId}}, cb)
  })
}

// S3 버킷에서 폴더 단위로 그룹화해서 URL 목록을 JSON 배열로 반환
module.exports.listUrls = (event, context, cb) => {
  const params = {
    Bucket: process.env.BUCKET,
    Delimiter: '/', // 폴더 단위로 그룹화
    MaxKeys: 10
  }

  // S3 버킷에서 객체 목록을 가져오는 API
  s3.listObjectsV2(params, (err, data) => {
    let promises = []
    if (err) { return respond(500, {stat: 'error', details: err}, cb) }

    // 폴더 단위로 그룹화하여 반복
    data.CommonPrefixes.forEach(prefix => {
      promises.push(readStatus(prefix.Prefix))
    })

    // 모든 폴더에 대한 url과 상태를 읽어서 결과를 반환
    Promise.all(promises).then(values => {
      let result = []
      values.forEach(value => {
        result.push({url: value.url, stat: value.stat})
      })
      respond(200, {stat: 'ok', details: result}, cb)
    })
  })
}

// S3 버킷에서 파일 status.json을 읽어서 분석된 내용을 반환
module.exports.listImages = (event, context, cb) => {
  const url = event.queryStringParameters.url
  const domain = urlParser.parse(url).hostname

  console.log('list images')
  readStatus(domain + '/').then(result => {
    respond(200, {stat: 'ok', details: result}, cb)
  })
}

