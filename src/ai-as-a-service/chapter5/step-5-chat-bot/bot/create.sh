#!/bin/bash

# --- 설정 ---
REGION="ap-northeast-2"
LANG="ko_KR"
BOT_NAME="TodoBot"
# 주의: 실제 환경에 맞는 정확한 ARN을 사용하세요.
# 예시: ROLE_ARN="arn:aws:iam::ACCOUNT_ID:role/service-role/YourLexBotRole"
# 아래 ARN은 예시이므로 실제 환경의 ARN으로 교체해야 합니다.
ROLE_ARN="arn:aws:iam::311141557640:role/service-role/AWSServiceRoleForLexBots" # <--- 실제 ARN 확인 필수!

# --- 함수 정의 ---

# 슬롯이 존재하지 않으면 생성하는 함수 (재시도 로직 포함)
create_slot_if_not_exists() {
  local intent_id=$1
  local slot_name=$2
  local slot_type_id=$3
  local prompt_value=$4
  local max_retries=5
  local retry_delay=25

  if [ -z "$intent_id" ]; then
      echo "오류: 슬롯 '$slot_name' 생성 시 인텐트 ID가 비어있습니다. 건너뜁니다."
      return 1
  fi

  echo "인텐트 '$intent_id'에 대한 슬롯 '$slot_name' 확인/생성 중..."
  sleep 3

  local existing
  existing=$(aws lexv2-models list-slots \
    --region "$REGION" \
    --bot-id "$BOT_ID" \
    --bot-version "DRAFT" \
    --locale-id "$LANG" \
    --intent-id "$intent_id" \
    --no-cli-pager \
    | jq -r --arg slot "$slot_name" '.slotSummaries[] | select(.slotName == $slot) | .slotName')

  if [ "$existing" == "$slot_name" ]; then
    echo "슬롯 '$slot_name'은(는) 인텐트 '$intent_id'에 이미 존재합니다. 생성을 건너뜁니다."
    return 0
  else
    echo "슬롯 '$slot_name' 생성을 시도합니다..."
    JSON_SETTING=$(cat <<EOF
{"slotConstraint":"Required","promptSpecification":{"messageGroups":[{"message":{"plainTextMessage":{"value":"$prompt_value"}}}],"maxRetries":2,"allowInterrupt":true}}
EOF
)

    local attempt=1
    while [ $attempt -le $max_retries ]; do
      echo "'$slot_name' 슬롯 생성 시도 $attempt / $max_retries..."
      local error_output
      error_output=$(mktemp)

      aws lexv2-models create-slot \
        --region "$REGION" \
        --bot-id "$BOT_ID" \
        --bot-version "DRAFT" \
        --locale-id "$LANG" \
        --intent-id "$intent_id" \
        --slot-name "$slot_name" \
        --slot-type-id "$slot_type_id" \
        --value-elicitation-setting "$JSON_SETTING" \
        --no-cli-pager 2> "$error_output"

      local exit_code=$?
      local error_message
      error_message=$(cat "$error_output")
      rm "$error_output"

      if [ $exit_code -eq 0 ]; then
        echo "'$slot_name' 슬롯 생성 성공 (시도 $attempt)."
        sleep 15
        return 0
      else
        echo "'$slot_name' 슬롯 생성 실패 (시도 $attempt, 종료 코드: $exit_code)."
        echo "에러 메시지 (일부): ${error_message:0:300}..."
        # 마지막 재시도 실패 시 전체 메시지 로깅 (선택 사항)
        if [ $attempt -eq $max_retries ]; then
            echo "마지막 재시도 실패. 전체 에러 메시지:"
            echo "$error_message"
        fi

        if [[ "$error_message" == *"PreconditionFailedException"* && "$error_message" == *"Failed to retrieve parent resource"* ]]; then
            echo "원인: 부모 인텐트 리소스가 아직 준비되지 않았을 수 있습니다."
            local current_retry_delay=$((retry_delay + attempt * 5))
            echo "$current_retry_delay 초 후 재시도합니다..."
            sleep $current_retry_delay
        elif [[ "$error_message" == *"ConflictException"* ]] || [[ "$error_message" == *"ResourceInUseException"* ]]; then
             if [ $attempt -lt $max_retries ]; then
                echo "$retry_delay 초 후 재시도합니다..."
                sleep $retry_delay
             else
                echo "'$slot_name' 슬롯에 대한 최대 재시도 횟수에 도달했습니다. 포기합니다."
                return 1
             fi
        else
            echo "재시도 불가능한 오류가 발생했습니다. 전체 메시지:"
            echo "$error_message"
            return 1
        fi
      fi
      ((attempt++))
    done
  fi
  # While 루프가 종료되었지만 성공/실패가 명확히 반환되지 않은 경우 (방어적 코딩)
  echo "알 수 없는 이유로 '$slot_name' 슬롯 생성 함수가 실패했습니다 (루프 종료)."
  return 1
}

# --- 메인 스크립트 실행 ---

# 1단계: IAM 역할
echo "[1/7단계] Lex용 IAM 서비스 연결 역할 확인/생성 중..."
aws iam get-role --role-name AWSServiceRoleForLexBots --region $REGION --no-cli-pager >/dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "  IAM 역할을 찾을 수 없습니다. AWSServiceRoleForLexBots를 생성합니다..."
  aws iam create-service-linked-role --aws-service-name lex.amazonaws.com --region $REGION --no-cli-pager
  echo "  IAM 역할 전파를 위해 20초 대기합니다..."
  sleep 20
else
  echo "  IAM 역할 AWSServiceRoleForLexBots가 이미 존재합니다."
fi
echo "[1/7단계] 완료."
echo "-----------------------------------------------"

# 2단계: 봇 확인/생성
echo "[2/7단계] 기존 봇 '$BOT_NAME' 확인 중..."
BOT_ID=$(aws lexv2-models list-bots --region $REGION --max-results 50 --no-cli-pager | jq -r --arg BOT_NAME "$BOT_NAME" '.botSummaries[] | select(.botName == $BOT_NAME) | .botId')

if [ -z "$BOT_ID" ]; then
  echo "  봇 '$BOT_NAME'을(를) 찾을 수 없습니다. 새 봇을 생성합니다..."
  cat <<EOF > todo-bot.json
{ "botName": "$BOT_NAME", "idleSessionTTLInSeconds": 300, "dataPrivacy": { "childDirected": false } }
EOF
  BOT_RESPONSE=$(aws lexv2-models create-bot --region $REGION --cli-input-json file://todo-bot.json --role-arn "$ROLE_ARN" --no-cli-pager)
  BOT_ID=$(echo "$BOT_RESPONSE" | jq -r '.botId')
  if [ -z "$BOT_ID" ] || [ "$BOT_ID" == "null" ]; then
      echo "  오류: 봇을 생성하거나 봇 ID를 가져오지 못했습니다. 응답: $BOT_RESPONSE"; rm todo-bot.json; exit 1
  fi
  echo "  새 봇이 생성되었습니다. ID: $BOT_ID"; rm todo-bot.json
  echo "  봇 생성을 위해 25초 대기합니다..."; sleep 25
else
  echo "  봇 '$BOT_NAME'이(가) 이미 존재합니다. 기존 봇 ID 사용: $BOT_ID"
fi
echo "[2/7단계] 완료."
echo "-----------------------------------------------"

# 3단계: 로케일 생성/확인
echo "[3/7단계] 봇 로케일 '$LANG' 생성 또는 확인 중..."
aws lexv2-models create-bot-locale --region "$REGION" --bot-id "$BOT_ID" --bot-version "DRAFT" --locale-id "$LANG" --nlu-intent-confidence-threshold 0.4 --no-cli-pager 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  로케일 '$LANG'이(가) 이미 존재하거나 생성 시도 중 오류가 발생했습니다 (존재하는 것으로 간주)."
    aws lexv2-models describe-bot-locale --region "$REGION" --bot-id "$BOT_ID" --bot-version "DRAFT" --locale-id "$LANG" --no-cli-pager > /dev/null 2>&1
    if [ $? -ne 0 ]; then echo "  오류: 기존 로케일 '$LANG'을 설명할 수 없습니다."; fi
else echo "  로케일 '$LANG' 생성/확인됨."; fi
echo "  로케일 안정화를 위해 20초 대기합니다..."; sleep 20
echo "[3/7단계] 완료."
echo "-----------------------------------------------"

# 4단계: 인텐트 확인/생성
echo "[4/7단계] 인텐트 확인/생성 중..."
CREATE_INTENT_ID=""
MARK_INTENT_ID=""
# 인텐트 생성 후 대기 시간 (120초 유지)
INTENT_CREATION_WAIT_TIME=120

# CreateTodo 인텐트
CREATE_INTENT_NAME="CreateTodo"
echo "  인텐트 '$CREATE_INTENT_NAME' 확인 중..."
CREATE_INTENT_ID=$(aws lexv2-models list-intents --bot-id $BOT_ID --bot-version DRAFT --locale-id $LANG --region $REGION --no-cli-pager | jq -r --arg INTENT_NAME "$CREATE_INTENT_NAME" '.intentSummaries[] | select(.intentName == $INTENT_NAME) | .intentId')

if [ -z "$CREATE_INTENT_ID" ]; then
  echo "  인텐트 '$CREATE_INTENT_NAME' 생성 중 (기본 설정만)..."
  SAMPLE_UTTERANCES_CREATE='[{"utterance":"할 일 추가"},{"utterance":"새 할 일 만들어 줘"},{"utterance":"{todoAction} 할래"}]'
  CREATE_INTENT_RESPONSE=$(aws lexv2-models create-intent --region "$REGION" --bot-id "$BOT_ID" --bot-version "DRAFT" --locale-id "$LANG" --intent-name "$CREATE_INTENT_NAME" --sample-utterances "$SAMPLE_UTTERANCES_CREATE" --dialog-code-hook '{"enabled":false}' --no-cli-pager)
  CREATE_INTENT_ID=$(echo "$CREATE_INTENT_RESPONSE" | jq -r '.intentId')
  if [ -z "$CREATE_INTENT_ID" ] || [ "$CREATE_INTENT_ID" == "null" ]; then
     echo "  오류: 인텐트 '$CREATE_INTENT_NAME' 생성 실패. 응답: $CREATE_INTENT_RESPONSE"; CREATE_INTENT_ID=""
  else
     echo "  인텐트 '$CREATE_INTENT_NAME' 생성됨. ID: $CREATE_INTENT_ID"
     echo "  인텐트 '$CREATE_INTENT_NAME' 전파를 위해 ${INTENT_CREATION_WAIT_TIME}초 대기합니다..."; sleep $INTENT_CREATION_WAIT_TIME
  fi
else
  echo "  인텐트 '$CREATE_INTENT_NAME'이(가) 이미 존재합니다. ID 사용: $CREATE_INTENT_ID"; echo "  기존 인텐트 '$CREATE_INTENT_NAME' 확인 후 10초 대기..."; sleep 10
fi

# MarkDone 인텐트
MARK_INTENT_NAME="MarkDone"
echo "  인텐트 '$MARK_INTENT_NAME' 확인 중..."
MARK_INTENT_ID=$(aws lexv2-models list-intents --bot-id $BOT_ID --bot-version DRAFT --locale-id $LANG --region $REGION --no-cli-pager | jq -r --arg INTENT_NAME "$MARK_INTENT_NAME" '.intentSummaries[] | select(.intentName == $INTENT_NAME) | .intentId')

if [ -z "$MARK_INTENT_ID" ]; then
  echo "  인텐트 '$MARK_INTENT_NAME' 생성 중 (기본 설정만)..."
  SAMPLE_UTTERANCES_MARK='[{"utterance":"완료했어"},{"utterance":"끝냈어"},{"utterance":"{todoAction} 다 했어"}]'
  MARK_INTENT_RESPONSE=$(aws lexv2-models create-intent --region "$REGION" --bot-id "$BOT_ID" --bot-version "DRAFT" --locale-id "$LANG" --intent-name "$MARK_INTENT_NAME" --sample-utterances "$SAMPLE_UTTERANCES_MARK" --dialog-code-hook '{"enabled":false}' --no-cli-pager)
  MARK_INTENT_ID=$(echo "$MARK_INTENT_RESPONSE" | jq -r '.intentId')
   if [ -z "$MARK_INTENT_ID" ] || [ "$MARK_INTENT_ID" == "null" ]; then
     echo "  오류: 인텐트 '$MARK_INTENT_NAME' 생성 실패. 응답: $MARK_INTENT_RESPONSE"; MARK_INTENT_ID=""
  else
    echo "  인텐트 '$MARK_INTENT_NAME' 생성됨. ID: $MARK_INTENT_ID"
    echo "  인텐트 '$MARK_INTENT_NAME' 전파를 위해 ${INTENT_CREATION_WAIT_TIME}초 대기합니다..."; sleep $INTENT_CREATION_WAIT_TIME
  fi
else
  echo "  인텐트 '$MARK_INTENT_NAME'이(가) 이미 존재합니다. ID 사용: $MARK_INTENT_ID"; echo "  기존 인텐트 '$MARK_INTENT_NAME' 확인 후 10초 대기..."; sleep 10
fi
echo "[4/7단계] 완료."
echo "-----------------------------------------------"

# 5단계: 슬롯 확인/생성
echo "[5/7단계] 슬롯 확인/생성 중..."
create_slot_success_due_date=0
create_slot_success_todo_action_create=0
create_slot_success_todo_action_mark=0

# CreateTodo 인텐트용 슬롯
if [ ! -z "$CREATE_INTENT_ID" ]; then
  create_slot_if_not_exists "$CREATE_INTENT_ID" "dueDate" "AMAZON.Date" "언제까지 해야 하나요?"; [ $? -eq 0 ] && create_slot_success_due_date=1
  create_slot_if_not_exists "$CREATE_INTENT_ID" "todoAction" "AMAZON.SearchQuery" "어떤 일을 해야 하나요?"; [ $? -eq 0 ] && create_slot_success_todo_action_create=1
else echo "  경고: CreateTodo 인텐트 ID가 없어 관련 슬롯 생성을 건너뜁니다."; fi

# MarkDone 인텐트용 슬롯
if [ ! -z "$MARK_INTENT_ID" ]; then
  create_slot_if_not_exists "$MARK_INTENT_ID" "todoAction" "AMAZON.SearchQuery" "어떤 일을 완료하셨나요?"; [ $? -eq 0 ] && create_slot_success_todo_action_mark=1
else echo "  경고: MarkDone 인텐트 ID가 없어 관련 슬롯 생성을 건너뜁니다."; fi

echo "  슬롯 생성 결과: dueDate=$create_slot_success_due_date, todoAction(Create)=$create_slot_success_todo_action_create, todoAction(Mark)=$create_slot_success_todo_action_mark"

# 슬롯 생성 실패 시 스크립트 중단 로직과
abort_script=0
if [ ! -z "$CREATE_INTENT_ID" ] && ([ "$create_slot_success_due_date" -ne 1 ] || [ "$create_slot_success_todo_action_create" -ne 1 ]); then
    echo "  오류: CreateTodo 인텐트에 필요한 슬롯 생성에 실패했습니다."
    [ "$create_slot_success_due_date" -ne 1 ] && echo "    - dueDate 실패"
    [ "$create_slot_success_todo_action_create" -ne 1 ] && echo "    - todoAction 실패"
    abort_script=1
fi
if [ ! -z "$MARK_INTENT_ID" ] && [ "$create_slot_success_todo_action_mark" -ne 1 ]; then
    echo "  오류: MarkDone 인텐트에 필요한 슬롯(todoAction) 생성에 실패했습니다."
    abort_script=1
fi

if [ "$abort_script" -eq 1 ]; then
    echo "필수 슬롯 생성 실패로 인해 스크립트를 중단합니다."
    exit 1 # 스크립트 종료
fi

echo "  모든 필수 슬롯 생성 확인 완료. 슬롯 안정화를 위해 20초 대기합니다..."
sleep 20
echo "[5/7단계] 완료."
echo "-----------------------------------------------"

# 6단계: 설정 및 우선순위로 인텐트 업데이트
echo "[6/7단계] 설정 및 우선순위로 인텐트 업데이트 중..."

# --- CreateTodo 인텐트 업데이트 ---
if [ ! -z "$CREATE_INTENT_ID" ]; then
  echo "  인텐트 '$CREATE_INTENT_NAME' ($CREATE_INTENT_ID) 업데이트 중..."
  echo "  '$CREATE_INTENT_NAME'에 대한 슬롯 ID 가져오는 중..."

  DUE_DATE_SLOT_ID=$(aws lexv2-models list-slots --bot-id $BOT_ID --bot-version DRAFT --locale-id $LANG --intent-id $CREATE_INTENT_ID --region $REGION --no-cli-pager --filters name=slotName,operator=EQ,values=dueDate --max-results 1 | jq -r '.slotSummaries[0].slotId // empty')
  TODO_ACTION_SLOT_ID_CREATE=$(aws lexv2-models list-slots --bot-id $BOT_ID --bot-version DRAFT --locale-id $LANG --intent-id $CREATE_INTENT_ID --region $REGION --no-cli-pager --filters name=slotName,operator=EQ,values=todoAction --max-results 1 | jq -r '.slotSummaries[0].slotId // empty')

  if [ ! -z "$DUE_DATE_SLOT_ID" ] && [ ! -z "$TODO_ACTION_SLOT_ID_CREATE" ]; then
    echo "    슬롯 ID 확인됨: dueDate=$DUE_DATE_SLOT_ID, todoAction=$TODO_ACTION_SLOT_ID_CREATE"
    SLOT_PRIORITIES_JSON="[{\"priority\": 1, \"slotId\": \"$DUE_DATE_SLOT_ID\"},{\"priority\": 2, \"slotId\": \"$TODO_ACTION_SLOT_ID_CREATE\"}]"
    CONFIRMATION_JSON='{"promptSpecification":{"maxRetries":2,"messageGroups":[{"message":{"plainTextMessage":{"value":"{todoAction} 등록할까요?"}}}],"allowInterrupt":true}}'
    CLOSING_JSON='{"closingResponse":{"messageGroups":[{"message":{"plainTextMessage":{"value":"등록 완료!"}}}],"allowInterrupt":true}}'

    echo "    '$CREATE_INTENT_NAME'에 대한 update-intent 실행 중..."
    aws lexv2-models update-intent \
      --region "$REGION" --bot-id "$BOT_ID" --bot-version "DRAFT" --locale-id "$LANG" \
      --intent-id "$CREATE_INTENT_ID" --intent-name "$CREATE_INTENT_NAME" \
      --slot-priorities "$SLOT_PRIORITIES_JSON" \
      --intent-confirmation-setting "$CONFIRMATION_JSON" \
      --intent-closing-setting "$CLOSING_JSON" \
      --no-cli-pager
    if [ $? -eq 0 ]; then echo "    인텐트 '$CREATE_INTENT_NAME' 업데이트 성공."; else echo "    오류: 인텐트 '$CREATE_INTENT_NAME' 업데이트 실패."; fi
    echo "    인텐트 업데이트 후 20초 대기..."; sleep 20
  else
    echo "  오류: '$CREATE_INTENT_NAME'에 필요한 슬롯 ID를 list-slots로 가져오는 데 실패했습니다."
    echo "    - dueDate Slot ID 조회 결과: '$DUE_DATE_SLOT_ID'"
    echo "    - todoAction Slot ID 조회 결과: '$TODO_ACTION_SLOT_ID_CREATE'"
    echo "  업데이트를 건너뜁니다. (이 메시지는 Step 5의 체크 로직으로 인해 이론상 나타나지 않아야 합니다)"
  fi
else
    echo "  알림: CreateTodo 인텐트가 존재하지 않아 업데이트를 건너뜁니다."
fi

# --- MarkDone 인텐트 업데이트 ---
if [ ! -z "$MARK_INTENT_ID" ]; then
  echo "  인텐트 '$MARK_INTENT_NAME' ($MARK_INTENT_ID) 업데이트 중..."
  echo "  '$MARK_INTENT_NAME'에 대한 슬롯 ID 가져오는 중..."

  TODO_ACTION_SLOT_ID_MARK=$(aws lexv2-models list-slots --bot-id $BOT_ID --bot-version DRAFT --locale-id $LANG --intent-id $MARK_INTENT_ID --region $REGION --no-cli-pager --filters name=slotName,operator=EQ,values=todoAction --max-results 1 | jq -r '.slotSummaries[0].slotId // empty')

  if [ ! -z "$TODO_ACTION_SLOT_ID_MARK" ]; then
    echo "    슬롯 ID 확인됨: todoAction=$TODO_ACTION_SLOT_ID_MARK"
    SLOT_PRIORITIES_JSON="[{\"priority\": 1, \"slotId\": \"$TODO_ACTION_SLOT_ID_MARK\"}]"
    CONFIRMATION_JSON='{"promptSpecification":{"maxRetries":2,"messageGroups":[{"message":{"plainTextMessage":{"value":"{todoAction} 완료 처리할까요?"}}}],"allowInterrupt":true}}'
    CLOSING_JSON='{"closingResponse":{"messageGroups":[{"message":{"plainTextMessage":{"value":"확인 완료! 다음 할 일도 파이팅!"}}}],"allowInterrupt":true}}'

    echo "    '$MARK_INTENT_NAME'에 대한 update-intent 실행 중..."
    aws lexv2-models update-intent \
      --region "$REGION" --bot-id "$BOT_ID" --bot-version "DRAFT" --locale-id "$LANG" \
      --intent-id "$MARK_INTENT_ID" --intent-name "$MARK_INTENT_NAME" \
      --slot-priorities "$SLOT_PRIORITIES_JSON" \
      --intent-confirmation-setting "$CONFIRMATION_JSON" \
      --intent-closing-setting "$CLOSING_JSON" \
      --no-cli-pager
    if [ $? -eq 0 ]; then echo "    인텐트 '$MARK_INTENT_NAME' 업데이트 성공."; else echo "    오류: 인텐트 '$MARK_INTENT_NAME' 업데이트 실패."; fi
    echo "    인텐트 업데이트 후 20초 대기..."; sleep 20
  else
    echo "  오류: '$MARK_INTENT_NAME'에 필요한 슬롯 ID(todoAction)를 list-slots로 가져오는 데 실패했습니다."
    echo "    - todoAction Slot ID 조회 결과: '$TODO_ACTION_SLOT_ID_MARK'"
    echo "  업데이트를 건너뜁니다. (이 메시지는 Step 5의 체크 로직으로 인해 이론상 나타나지 않아야 합니다)"
  fi
else
    echo "  알림: MarkDone 인텐트가 존재하지 않아 업데이트를 건너뜁니다."
fi
echo "[6/7단계] 완료."
echo "-----------------------------------------------"

# 7단계: 봇 로케일 빌드
echo "[7/7단계] 봇 로케일 빌드 시작 중..."
echo "  빌드 전 최종 안정화를 위해 15초 대기합니다..."; sleep 15

BUILD_RESPONSE=$(aws lexv2-models build-bot-locale \
  --region "$REGION" --bot-id "$BOT_ID" --bot-version "DRAFT" --locale-id "$LANG" --no-cli-pager)
BUILD_ID=$(echo "$BUILD_RESPONSE" | jq -r '.buildId // empty')
BUILD_STATUS=$(echo "$BUILD_RESPONSE" | jq -r '.botLocaleStatus // "Unknown"')

if [ ! -z "$BUILD_ID" ]; then echo "  빌드 제출됨. 빌드 ID: $BUILD_ID, 초기 상태: $BUILD_STATUS";
elif [[ "$BUILD_STATUS" == "Building" || "$BUILD_STATUS" == "ReadyExpressTesting" || "$BUILD_STATUS" == "Built" ]]; then echo "  빌드가 이미 진행 중이거나 완료된 상태입니다. 현재 상태: $BUILD_STATUS";
else echo "  경고: 빌드 ID를 가져오지 못했습니다. 응답: $BUILD_RESPONSE"; fi

echo "  봇 로케일 빌드 완료 대기 중..."
build_wait_time=0; build_timeout=720; check_interval=25

while true; do
  sleep 2
  STATUS_INFO=$(aws lexv2-models describe-bot-locale --region "$REGION" --bot-id "$BOT_ID" --bot-version "DRAFT" --locale-id "$LANG" --no-cli-pager 2>/dev/null)

  if [ $? -ne 0 ]; then
      echo "  경고: 로케일 상태 조회 API 호출 실패. ${check_interval}초 후 재시도..."; sleep $check_interval
      build_wait_time=$((build_wait_time + check_interval + 2))
  else
      STATUS=$(echo "$STATUS_INFO" | jq -r '.botLocaleStatus // "Unknown"')
      echo "  현재 로케일 상태: $STATUS (경과 시간: ${build_wait_time}초)"

      if [[ "$STATUS" == "Built" || "$STATUS" == "ReadyExpressTesting" ]]; then echo "===============================================\nLex V2 봇 로케일 빌드 성공!\n==============================================="; break
      elif [[ "$STATUS" == "Failed" ]]; then
        FAILURE_REASONS=$(echo "$STATUS_INFO" | jq -r '.failureReasons[]? // "N/A"')
        echo "===============================================\n오류: 빌드 실패."
        if [ "$FAILURE_REASONS" != "N/A" ]; then echo "실패 사유:"; echo "$FAILURE_REASONS" | sed 's/^/  /'; fi
        echo "인텐트/슬롯 정의 및 AWS Lex 콘솔 로그를 확인하세요.\n==============================================="; exit 1
      elif [[ "$STATUS" == "Creating" || "$STATUS" == "Building" ]]; then :
      elif [[ "$STATUS" == "NotBuilt" ]]; then
         echo "  경고: 로케일 상태가 'NotBuilt'입니다. ${check_interval}초 후 빌드를 다시 시도합니다..."; sleep $check_interval
         build_wait_time=$((build_wait_time + check_interval + 2))
         aws lexv2-models build-bot-locale --region "$REGION" --bot-id "$BOT_ID" --bot-version "DRAFT" --locale-id "$LANG" --no-cli-pager > /dev/null
         continue
      elif [[ "$STATUS" == "Deleting" ]]; then echo "오류: 로케일이 삭제 중입니다."; exit 1
      elif [[ "$STATUS" == "Unknown" ]]; then echo "  경고: 알 수 없는 로케일 상태 응답. 잠시 후 다시 확인."
      else echo "  알 수 없는 상태 '$STATUS' 발생. 대기 후 재확인..."; fi
      sleep $check_interval; build_wait_time=$((build_wait_time + check_interval + 2))
  fi

  if [ $build_wait_time -gt $build_timeout ]; then
      echo "===============================================\n오류: 봇 로케일 빌드 시간 초과 (${build_timeout}초).\n마지막 확인된 상태: $STATUS\nAWS 콘솔에서 상태를 직접 확인하세요.\n==============================================="; exit 1
  fi
done

echo "Lex V2 봇 배포 스크립트가 성공적으로 완료되었습니다."
exit 0
