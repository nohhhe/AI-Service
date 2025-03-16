'use strict'

const request = require('request')
const AWS = require('aws-sdk')
var trans = new AWS.TranscribeService()

// 응답을 반환하는 함수
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

// 오디오 파일을 텍스트로 변환하는 함수
module.exports.transcribe = (event, context, cb) => {
  const body = JSON.parse(event.body)

  const params = {
    LanguageCode: body.noteLang, // 오디오 파일 언어 설정
    Media: { MediaFileUri: body.noteUri }, // 오디오 파일 S3 경로
    MediaFormat: body.noteFormat, // 오디오 파일 포맷
    TranscriptionJobName: body.noteName, // 트랜스크립션 작업 이름
    MediaSampleRateHertz: body.noteSampleRate, // 오디오 파일 샘플링 속도
    Settings: {
      ChannelIdentification: false, // 여러 채널을 구분할 지 여부
      MaxSpeakerLabels: 4, // 최대 몇명까지 구분할 지
      ShowSpeakerLabels: true // 인원 구분 여부
    }
  }

  // 변환 작업을 시작하는 함수
  trans.startTranscriptionJob(params, (err, data) => {
    respond(err, data, cb)
  })
}

// 주기적으로 변환 작업 상태를 확인하는 함수
module.exports.poll = (event, context, cb) => {
  const params = { TranscriptionJobName: event.pathParameters.id }

  console.log(JSON.stringify(params))
  // 변환 작업 상태를 확인하는 함수
  trans.getTranscriptionJob(params, (err, data) => {
    // 오류가 발생하면 오류 메시지를 반환
    if (err) {
      console.log(err)
      return respond(err, {}, cb)
    }

    if (data && data.TranscriptionJob) {
      // 변환 작업이 완료되면 변환된 텍스트를 반환
      if (data.TranscriptionJob.TranscriptionJobStatus === 'COMPLETED') {
        // 변환된 텍스트 파일을 가져오는 함수
        request(data.TranscriptionJob.Transcript.TranscriptFileUri, (err, response, responseBody) => {
          let result

          if (!err && response && response.statusCode === 200) {
            // 응답 결과를 JSON 형태로 변환
            result = JSON.parse(responseBody)
          } else {
            // 오류가 발생하면 오류 메시지와 상태 코드를 반환
            result = {resultErr: err, resultResponse: response.statusCode}
          }

          // 변환 상태를 반환
          result.transcribeStatus = data.TranscriptionJob.TranscriptionJobStatus
          console.log(JSON.stringify(result))

          // 변환 결과를 반환
          respond(err, result, cb)
        })
      } else {
        console.log(JSON.stringify({transcribeStatus: data.TranscriptionJob.TranscriptionJobStatus}))
        // 변환이 완료되지 않은 경우 변환 상태만 반환
        respond(err, {transcribeStatus: data.TranscriptionJob.TranscriptionJobStatus}, cb)
      }
    } else {
      // 변환 작업이 존재하지 않을 경우 빈 객체 반환
      respond(err, {}, cb)
    }
  })
}

