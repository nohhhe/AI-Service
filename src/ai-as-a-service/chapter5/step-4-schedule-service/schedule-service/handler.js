'use strict'

const moment = require('moment')
const AWS = require('aws-sdk')
const dynamoDb = new AWS.DynamoDB.DocumentClient()
const polly = new AWS.Polly()
const s3 = new AWS.S3()
const TABLE_NAME = { TableName: process.env.TODO_TABLE }


function respond (err, body, cb) {
  let statusCode = 200

  body = body || {}
  if (err) {
    body.stat = 'err'
    body.err = err
    if (err.statusCode) {
      statusCode = err.statusCode
    } else {
      statusCode = 500
    }
  } else {
    body.stat = 'ok'
  }

  const response = {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      statusCode: statusCode
    },
    body: JSON.stringify(body)
  }

  cb(null, response)
}


// 스케줄을 생성하는 함수
function buildSchedule (date, speakDate, cb) {
  let speech = '<s>Your schedule for ' + speakDate + '</s>'
  let added = false
  const params = TABLE_NAME

  // DynamoDB에서 스케줄을 가져오는 쿼리
  dynamoDb.scan(params, (err, data) => {
    data.Items.forEach((item) => {
      if (item.dueDate === date) {
        added = true
        speech += '<s>' + item.action + '</s>'
        if (item.note) {
          speech += '<s>' + item.note + '</s>'
        }
      }
    })
    // 스케줄이 없는 경우
    if (!added) {
      speech += '<s>You have no scheduled actions</s>'
    }
    const ssml = `<speak><p>${speech}</p></speak>`
    cb(err, {ssml: ssml})
  })
}

// 오늘 일정을 만들어 TTS 작업을 폴리에 보내는 함수
module.exports.day = (event, context, cb) => {
  let date = moment().format('MM/DD/YYYY')
  // 음성으로 읽기 좋은 포맷으로 변경
  let speakDate = moment().format('dddd, MMMM Do YYYY')

  // 스케줄을 생성하는 함수 호출
  buildSchedule(date, speakDate, (err, schedule) => {
    if (err) { return respond(err, null, cb) }

    let params = {
      OutputFormat: 'mp3',
      SampleRate: '8000',
      Text: schedule.ssml,
      LanguageCode: 'en-GB',
      TextType: 'ssml',
      VoiceId: 'Joanna', // 사용할 목소리
      OutputS3BucketName: process.env.CHAPTER4_DATA_BUCKET,
      OutputS3KeyPrefix: 'schedule'
    }

    // 폴리에 음성 합성 작업을 요청
    polly.startSpeechSynthesisTask(params, (err, data) => {
      if (err) { return respond(err, null, cb) }

      // 작업 결과를 가공하여 반환
      let result = {
        taskId: data.SynthesisTask.TaskId, // 작업 ID
        taskStatus: data.SynthesisTask.TaskStatus, // 작업 상태
        taskUri: data.SynthesisTask.OutputUri // 작업 URI
      }
      respond(err, result, cb)
    })
  })
}

/// 작업 상태를 확인하고 완료된 오디오 파일에 대한 참조를 반환하는 함수
module.exports.poll = (event, context, cb) => {
  // 폴리에 작업 ID를 요청하여 작업 상태를 확인
  polly.getSpeechSynthesisTask({TaskId: event.pathParameters.id}, (err, data) => {
    if (err) { return respond(err, null, cb) }

    let params = {Bucket: process.env.CHAPTER4_DATA_BUCKET, Key: 'schedule.' + data.SynthesisTask.TaskId + '.mp3'}
    // S3에서 오디오 파일에 대한 서명된 URL을 생성
    let signedUrl = s3.getSignedUrl('getObject', params)
    let result = {
      taskId: data.SynthesisTask.TaskId,
      taskStatus: data.SynthesisTask.TaskStatus,
      taskUri: data.SynthesisTask.OutputUri,
      signedUrl: signedUrl
    }
    respond(err, result, cb)
  })
}
