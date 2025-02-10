/* globals $:false imageListItemTpl:false imageListTpl:false WordCloud:false Chart:false */
"use strict";

const BUCKET_ROOT = "http://hhcrawlerbucket.s3-website.ap-northeast-2.amazonaws.com"; // 주소 형태: https://s3-eu-west-1.amazonaws.com/<YOUR BUCKET NAME>
const API_ROOT = "https://chapter2api.hhnai.com/api/";

// URL 내 쿼리 문자열을 제거하여 출력
function displayableUrl(url) {
  let disp = url;
  if (disp) {
    const offset = disp.indexOf("?");
    if (offset !== -1) {
      disp = disp.substring(0, offset);
    }
  }
  return disp;
}

// URL 목록 API를 호출하여 목록을 가져와 화면에 출력
function renderUrlList() {
  $.getJSON(API_ROOT + "url/list", function(body) {
    if (body.stat === "ok") {
      let list = body.details;
      let output = '<ul class="list-group" id="url-list">';

      list.forEach(item => {
        // URL 내 쿼리 문자열을 제거하여 화면에 출력
        const disp = displayableUrl(item.url);
        output +=
          '<li class="list-group-item d-flex justify-content-between align-items-center"><a href="#" class="target-url">' +
          disp +
          '</a><span class="badge badge-primary badge-pill">' +
          item.stat +
          "</span></li>";
      });
      output += "</ul>";
      $("#content").html(output);

      // URL 클릭 시 URL에 대한 이미지 분석 데이터를 가져와 화면에 출력
      $("#url-list li .target-url").on("click", function(e) {
        e.preventDefault();
        renderUrlDetail(this.innerHTML);
      });
    } else {
      $("#content").html(body.details);
    }
  });
}

// 분석된 각 라벨의 빈도 수를 히스토그램으로 표시
function drawHistogram(data) {
  let ctx = document.getElementById("histogram").getContext("2d");
  let labels = [];
  let dataPoints = [];

  data.details.wordCloudList.forEach(item => {
    if (item[1] > 1) {
      labels.push(item[0]);
      dataPoints.push(item[1]);
    }
  });

  let chart = new Chart(ctx, {
    type: "bar",
    data: {
      // labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
      labels: labels,
      datasets: [
        {
          label: "Label Frequency",
          backgroundColor: "rgb(0, 99, 132)",
          borderColor: "rgb(0, 99, 132)",
          data: dataPoints
        }
      ]
    },
    options: {
      responsive: false
    }
  });
}

// 특정 URL에 대한 이미지 분석 데이터를 가져와, 이미지 리스트, 워드 클라우드, 히스토그램을 화면에 출력하는 역할하는 함수
function renderUrlDetail(url) {
  let list = "";
  let output = "";
  let wclist = [];

  // URL에 대한 이미지 분석 데이터를 가져옴
  $.getJSON(API_ROOT + "image/list?url=" + url, function(data) {
    if (data.stat === "ok") {
      if (data.details && data.details.stat === "analyzed") {
        data.details.analysisResults.forEach(item => {
          if (!item.err) {
            // 각 이미지와 분석 결과를 표시
            list += imageListItemTpl(BUCKET_ROOT, item);
          }
        });

        const disp = displayableUrl(data.details.url);
        // URL과 이미지 목록, 분석 결과를 표시
        output = imageListTpl(disp, list);
        $("#content").html(output);

        // 분석된 각 라벨의 빈도 수를 워드 클라우드 리스트 변수에 세팅
        data.details.wordCloudList.forEach(item => {
          if (item[1] > 1) {
            wclist.push(item);
          }
        });

        let options = {
          /*
          gridSize: Math.round(16 * $('#word-cloud').width() / 512),
          weightFactor: function (size) {
            return Math.pow(size, 2.3) * $('#word-cloud').width() / 512
          },
          */
          gridSize: 5,
          weightFactor: 4.5,
          fontFamily: "Times, serif",
          color: "random-dark",
          shuffle: false,
          rotateRatio: 0.5,
          list: wclist,
          shrinkToFit: true,
          clearCanvas: true
        };

        // 분석된 각 라벨의 빈도 수를 워드 클라우드로 표시
        WordCloud(document.getElementById("word-cloud"), options);

        // 분석된 각 라벨의 빈도 수를 히스토그램으로 표시
        drawHistogram(data);
      } else {
        $("#content").html("Awaiting analysis!!");
      }
    } else {
      $("#content").html("ERROR!! " + data.stat);
    }
  });
}

$(function() {
  // URL 목록 API를 호출하여 목록을 가져와 화면에 출력
  renderUrlList();

  // URL 입력 후 분석 요청 버튼 클릭 시 URL 분석 요청
  $("#submit-url-button").on("click", function(e) {
    e.preventDefault();
    $.ajax({
      url: API_ROOT + "url/analyze",
      type: "post",
      data: JSON.stringify({ url: $("#target-url").val() }),
      dataType: "json",
      contentType: "application/json",
      success: (data, stat) => {}
    });
  });
});
