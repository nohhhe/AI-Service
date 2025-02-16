'use strict'

const uuid = require('uuid')
const AWS = require('aws-sdk')
// 다이나모DB와 상호작용할 수 있는 DocumentClient 객체를 생성
const dynamoDb = new AWS.DynamoDB.DocumentClient()
const TABLE_NAME = { TableName: process.env.TODO_TABLE }

// 응답을 생성하는 함수
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

// action과 note가 빈 문자열이면 null로 변경 (다이나모 DB에 빈 문자열을 저장할 수 없음)
function removeEmpty (data) {
  if (data.action.length === 0) { data.action = null }
  if (data.note.length === 0) { data.note = null }
}

// 다이나모 DB에 데이터를 저장하는 함수
module.exports.create = (event, context, cb) => {
  const data = JSON.parse(event.body)
  // action과 note가 빈 문자열이면 null로 변경
  removeEmpty(data)

  // uuid를 생성하여 id로 사용
  data.id = uuid.v1()
  data.modifiedTime = new Date().getTime()

  const params = { ...TABLE_NAME, Item: data }
  // DynamoDB에 데이터를 저장
  dynamoDb.put(params, (err, data) => {
    respond(err, {data: data}, cb)
  })
}

// 다이나모 DB에서 데이터를 읽어오는 함수
module.exports.read = (event, context, cb) => {
  const params = { ...TABLE_NAME, Key: { id: event.pathParameters.id } }
  // DynamoDB에서 데이터를 읽어옴
  dynamoDb.get(params, (err, data) => {
    respond(err, data, cb)
  })
}

// 다이나모 DB에 데이터를 업데이트하는 함수 (다이나모 DB put은 Upsert 동작)
module.exports.update = (event, context, cb) => {
  const data = JSON.parse(event.body)
  removeEmpty(data)

  data.id = event.pathParameters.id
  data.modifiedTime = new Date().getTime()
  const params = { ...TABLE_NAME, Item: data }

  // DynamoDB에 데이터를 업데이트
  dynamoDb.put(params, (err, data) => {
    console.log(err)
    console.log(data)
    respond(err, data, cb)
  })
}

// 다이나모 DB에서 데이터를 삭제하는 함수
module.exports.delete = (event, context, cb) => {
  const params = { ...TABLE_NAME, Key: { id: event.pathParameters.id } }
  // DynamoDB에서 데이터를 삭제
  dynamoDb.delete(params, (err, data) => {
    respond(err, data, cb)
  })
}

// 다이나모 DB에서 데이터를 읽어오는 함수 (모든 데이터를 읽어옴)
module.exports.list = (event, context, cb) => {
  const params = TABLE_NAME
  // DynamoDB에 데이터를 스캔
  dynamoDb.scan(params, (err, data) => {
    respond(err, data, cb)
  })
}

