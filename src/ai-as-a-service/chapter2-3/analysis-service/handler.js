'use strict'

const asnc = require('async')
const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const rek = new AWS.Rekognition() // 레코그니션 인터페이스 생성

// 레코그니션을 사용하여 이미지 라벨을 분석하는 함수
function analyzeImageLabels (imageBucketKey) {
  /* 레코그니션에 전달할 매개변수
   * Image: 분석할 이미지의 정보
     * Bucket: 이미지가 저장된 버킷의 이름
     * Name: 이미지의 키 이름
   * MaxLabels: 반환할 라벨의 최대 수
   * MinConfidence: 반환할 라벨의 최소 신뢰도
   */
  const params = {
    Image: {
      S3Object: {
        Bucket: process.env.BUCKET,
        Name: imageBucketKey
      }
    },
    MaxLabels: 10,
    MinConfidence: 80
  }
  return new Promise((resolve, reject) => {
    // 레코그니션에서 제공하는 이미지 분석 API
    rek.detectLabels(params, (err, data) => {
      if (err) { return resolve({image: imageBucketKey, labels: [], err: err}) }
      return resolve({image: imageBucketKey, labels: data.Labels})
    })
  })
}

// 분석 결과를 S3에 기록하는 함수
function writeAnalysis (domain, labels, wcList) {
  return new Promise((resolve) => {
    var params = {
      Bucket: process.env.BUCKET,
      Key: domain + '/status.json'
    }

    // S3에서 크롤러 서비스의 상태 파일을 가져옴
    s3.getObject(params, (err, data) => {
      if (err) { return resolve({stat: err}) }
      let statFile = JSON.parse(data.Body.toString())
      statFile.analysisResults = labels
      statFile.wordCloudList = wcList
      statFile.stat = 'analyzed'
      // 분석 결과를 추가하여 S3에 업로드
      s3.putObject({Bucket: process.env.BUCKET, Key: domain + '/status.json', Body: Buffer.from(JSON.stringify(statFile, null, 2), 'utf8')}, (err, data) => {
        resolve({stat: err || 'ok'})
      })
    })
  })
}

// 분석 결과에서 각 라벨의 빈도 수를 계산하는 함수
function wordCloudList (labels) {
  let counts = {}
  let wcList = []

  labels.forEach(set => {
    set.labels.forEach(lab => {
      if (!counts[lab.Name]) {
        counts[lab.Name] = 1
      } else {
        counts[lab.Name] = counts[lab.Name] + 1
      }
    })
  })

  Object.keys(counts).forEach(key => {
    wcList.push([key, counts[key]])
  })
  return wcList
}

// 이미지 버킷에서 특정 도메인의 이미지를 분석하는 함수
function iterateBucket (domain) {
  let promises = []
  /* S3 객체 목록을 가져오기 위한 매개변수
   * Bucket: 객체가 저장된 버킷의 이름
   * Prefix: 객체 키 이름의 접두사
   * MaxKeys: 반환할 객체의 최대 수
   */
  const params = {
    Bucket: process.env.BUCKET,
    Prefix: domain,
    MaxKeys: 10
  }

  return new Promise(resolve => {
    // listObjectsV2는 S3 버킷에서 객체 목록을 가져오는 API
    s3.listObjectsV2(params, (err, data) => {
      if (err) { return resolve({statusCode: 500, body: JSON.stringify(err)}) }
      data.Contents.forEach(imageFile => {
        // status.json 파일은 분석 대상에서 제외
        if (imageFile.Key !== domain + '/status.json') {
          // 레코그니션을 사용하여 이미지 라벨을 분석하는 함수 호출
          promises.push(analyzeImageLabels(imageFile.Key))
        }
      })

      // 모든 이미지 라벨 분석이 완료되면 결과를 기록한다.
      Promise.all(promises).then(results => {
        // 분석 결과를 S3에 기록하는 함수 호출
        writeAnalysis(domain, results, wordCloudList(results)).then(result => {
          resolve({statusCode: 200, body: JSON.stringify(result)})
        })
      })
    })
  })
}

/* 분석 서비스의 진입점
 * event: 처리 중인 현재 이벤트에 대한 정보를 제공한다. 객체가 SQS 큐에서 가져온 레코드 배열을 보유한다.
 * context: 호출에 대한 정보를 제공하기 위하여 AWS에서 사용하는 인수로, 사용 가능한 메모리, 실행 시간, 클라이언트 호출 컨텍스트 등의 정보를 담는다.
 * cb: 콜백 함수, 처리가 완료되면 핸들러가 결과와 함께 이 함수를 호출한다.
 */
module.exports.analyzeImages = function (event, context, cb) {
  // 메시지를 기준으로 반복 처리
  asnc.eachSeries(event.Records, (record, asnCb) => {
    let { body } = record

    try {
      body = JSON.parse(body)
    } catch (exp) {
      return asnCb('message parse error: ' + record)
    }

    // 메시지 유형 확인 및 유효성 검사
    if (body.action === 'analyze' && body.msg && body.msg.domain) {
      // 이미지 버킷에서 특정 도메인의 이미지를 분석하는 함수 호출
      iterateBucket(body.msg.domain, context).then(result => {
        asnCb(null, result)
      })
    } else {
      asnCb()
    }
  }, (err) => {
    if (err) { console.log(err) }
    cb()
  })
}
