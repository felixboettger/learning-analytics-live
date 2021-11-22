//jshint esversion:6

const [sessionKey, secret] = getCookieValues();
const directLink = getDirectLink();
const webSocket = createWebSocket(sessionKey, secret);
var [concentrationPlot, emotionPie] = initializeCharts();
var surveyURL;

let concentrationTimeframe = 100;
let concentrationArray = Array(100);
concentrationArray = concentrationArray.fill([0, 0]);

document.getElementById("session-key").innerHTML = sessionKey;

// --- Event Listeners ---

// WebSocket

webSocket.addEventListener("message", function(event) {
  const messageJSON = JSON.parse(event.data);
  const datatype = messageJSON.datatype;
  if (datatype === "participants") {
    refreshDashboard(messageJSON.data);
  } else if (datatype === "download") {
    downloadJSONFile(messageJSON.data);
  } 
});

webSocket.onclose = function() {
  alert("Session has ended. Click ok to go back to the homepage.");
  const url = window.location;
  url.replace(url.protocol + "//" + url.host + "/");
}

// Buttons

document.getElementById("change-goodbye-text").addEventListener("click", function(){
  newGoodbyeText = prompt("Please enter new goodbye text:");
  sendGoodbyeText(newGoodbyeText);
  document.getElementById("goodbye-text").innerHTML = "Goodbye Text: " + newGoodbyeText
})

document.getElementById("change-survey-url").addEventListener("click", function(){
  newSurveyURL = prompt("Please enter survey url:");
  sendSurveyURL(newSurveyURL);
  document.getElementById("survey-url").innerHTML = "Survey URL: " + newSurveyURL
})

document.getElementById("end-btn").addEventListener("click", function() {
  document.getElementById("end-btn").classList.toggle("blinking");
  if (confirm("Click ok to end this session. All clients will automatically leave the session and the goodbye message will be displayed.")) {
    webSocket.send(JSON.stringify({
      datatype: "end"
    }))
    const url = window.location;
    url.replace(url.protocol + "//" + url.host + "/");
  }
});

document.getElementById("link-btn").addEventListener("click", function() {
  navigator.clipboard.writeText(directLink).then(function() {
    document.getElementById("link-btn").classList.toggle("blinking");
  }, function(err) {
    console.error('Async: Could not copy text: ', err);
  });

});

document.getElementById("key-btn").addEventListener("click", function() {
  navigator.clipboard.writeText(sessionKey).then(function() {
    document.getElementById("key-btn").classList.toggle("blinking");
  }, function(err) {
    console.error('Async: Could not copy text: ', err);
  });
});

document.getElementById("session-key-display").addEventListener("click", function() {
  navigator.clipboard.writeText(sessionKey).then(function() {
    document.getElementById("session-key-display").classList.toggle("blinking");
  }, function(err) {
    console.error('Async: Could not copy text: ', err);
  });

});

document.getElementById("dropup-timeframe").addEventListener("click", function() {
  const items = document.getElementById("dropup-timeframe").nextElementSibling;
  if (items.style.display == "block") {
    items.style.display = "none";
  } else {
    items.style.display = "block";
  }
});

const timeframeButtons = document.getElementsByClassName("timeframe-set");
[].slice.call(timeframeButtons).forEach((timeframeButton) => {
  timeframeButton.addEventListener("click", function() {
    changeConcentrationTimeframe(timeframeButton.lastChild.innerHTML);
    const items = document.getElementById("dropup-timeframe").nextElementSibling;
    items.style.display = "none";
  });
});

// --- Function Definitions ---

/**
 * addOrChangeParticipant - Function that adds a participant to the dashboard list or changes it if it exists.
 *
 * @param  {string} participantElement HTML Element with participant info.
 * @param  {int} id ID (participantId) of the participant.
 */
function addOrChangeParticipant(participantElement, id) {
  if (document.getElementById(id)) {
    document.getElementById(id).innerHTML = participantElement;
  } else {
    const newTr = document.createElement("tr");
    newTr.setAttribute('id', id);
    newTr.setAttribute('class', 'participant');
    document.getElementById("participant-list").appendChild(newTr);
  }
}

/**
 * createWebSocket - Function that creates a WebSocket and connects to the server.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {string} secret     Secret that is used to authenticate the host.
 * @return {object} WebSocket Object.
 */
function createWebSocket(sessionKey, secret) {
  const wl = window.location;
  const webSocketProtocol = (wl.protocol === "https:") ? "wss://" : "ws://";
  const domain = document.domain;
  const port = location.port;
  const webSocketAddress = webSocketProtocol + domain + ":" + port;
  const sessionKeyParam = "/?sessionKey=" + sessionKey;
  const secretParam = "&hsecret=" + secret;
  const typeParam = "&type=dashboard";
  const webSocketURL = webSocketAddress + sessionKeyParam + secretParam + typeParam;
  return new WebSocket(webSocketURL, "echo-protocol");
}

/**
 * downloadJSONFile - Function that initiates the download for a text file.
 *
 * @param  {object} object The JSON Object returned by the server for export.
 */
function downloadJSONFile(object) {
  const downloadElement = document.createElement("a");
  const date = new Date();
  downloadElement.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(object)));
  downloadElement.setAttribute("download", "Session " + sessionKey + "on " + date);
  downloadElement.click();
}


/**
 * generateParticipantElement - Function that generates an HTML Element with all participant info (for the participant list)
 *
 * @param  {string} name Name of the participant.
 * @param  {string} emotion Emotion of the participant.
 * @param  {array} objects Object detected in participant's video.
 * @param  {boolean} looks Boolean if the participant looks into the camera.
 * @param  {int} concentrationScore Concentration score of the participant.
 * @return {string} HTML participant element.
 */
function generateParticipantElement(name, emotion, objects, looks, concentrationScore) {
  const participantElement = `
    <td>` + name + `</td>
    <td>` + emotion + `</td>
    <td>` + objects + `</td>
    <td>` + looks + `</td>
    <td>
      <div class="progress">
        <div class="progress-bar bg-green" role="progressbar" aria-valuenow="` + concentrationScore + `" aria-valuemin="0" aria-valuemax="100" style="width: ` + concentrationScore + `%"></div>
      </div>
    </td>
  `;
  return participantElement;
}

/**
 * getCookieValues - Function that reads cookies.
 *
 * @return {array} Array containing sessionKey and secret for the session as saved in cookies.
 */
function getCookieValues() {
  const cookieValues = document.cookie.split('; ');
  const sessionKey = cookieValues.find(row => row.startsWith('sessionKey=')).split('=')[1];
  const secret = cookieValues.find(row => row.startsWith('hsecret=')).split('=')[1];
  return [sessionKey, secret];
}


/**
 * getDirectLink - Function that generates the direct link to join the session.
 *
 * @return {string} Direct link to the session.
 */
function getDirectLink() {
  const wl = window.location;
  return wl.protocol + "//" + wl.host + "/join/" + sessionKey;
}


/**
 * getFullEmotionName - Function that tranlates the emotion abbreviation into the full emotion name.
 *
 * @param  {string} emotion Emotion abbreviation.
 * @return {string} Full emotion text.
 */
function getFullEmotionName(emotion) {
  switch (emotion) {
    case "ha":
      return "happy";
      break;
    case "ne":
      return "neutral";
      break;
    case "sa":
      return "sad";
      break;
    case "fe":
      return "fearful";
      break;
    case "di":
      return "disgusted";
      break;
    case "an":
      return "angry";
      break;
    case "su":
      return "surprised";
      break;
    default:
      return ""
      break;
  }
}


/**
 * refreshDashboard - Function that refreshes the Dashboard.
 *
 * @param  {array} participantsList List with all participants and their statuses as sent by server via WebSocket.
 */
function refreshDashboard(participantsList) {
  // variables: apc - active pariticpants, lacc - looking at camera, ec - emotions,
  // mcs - mean concentration score, ha - happy sa - sad, ne - neutral, di - disgusted,
  // fe - fearful, su - surprised, an - angry
  var counterElements = {
    apc: 0,
    lacc: 0,
    mcs: 0,
    ec: {
      "ha": 0,
      "sa": 0,
      "ne": 0,
      "di": 0,
      "fe": 0,
      "su": 0,
      "an": 0
    },
  };
  participantsList.forEach(function(participant) {
    const {
      inactive,
      currentStatus,
      id,
      name
    } = participant;
    if (!(inactive)) {
      const {
        concentrationScore,
        emotion,
        looks,
        objects
      } = (currentStatus === undefined) ? "" : currentStatus;
      if (!(emotion === undefined)) {
        counterElements.ec[emotion.substr(0, 2)] += 1;
      }
      counterElements.apc += 1;
      counterElements.lacc += (currentStatus.looks) ? 1 : 0;
      counterElements.mcs += currentStatus.concentrationScore || 0;
      const fullEmotion = getFullEmotionName(emotion);
      participantElement = generateParticipantElement(name, fullEmotion, objects, looks, concentrationScore);
      addOrChangeParticipant(participantElement, id);
    } else {
      removeParticipant(id);
    }
  });
  if (counterElements.apc > 0) {
    counterElements.mcs = Math.round(counterElements.mcs / counterElements.apc);
  }
  updateConcentrationPlot(counterElements.mcs);
  updateEmotionPie(counterElements.ec);
  setCounterElements(counterElements);
}

/**
 * updateConcentrationPlot - Function that updates the concentration plot of the dashboard.
 *
 * @param  {int} concentrationScore Mean concentration score as calculated by refreshDashboard().
 */
function updateConcentrationPlot(concentrationScore) {
  (concentrationArray.length > concentrationTimeframe) ? concentrationArray.shift(): "";
  concentrationArray.push([0, concentrationScore]);
  const nrDataPoints = concentrationArray.length;
  for (let i = 0; i < nrDataPoints; i++) {
    concentrationArray[i] = [i, concentrationArray[i][1]];
  }
  $(function() {
    concentrationPlot.setData([concentrationArray]);
    concentrationPlot.draw();
  });
}


/**
 * changeConcentrationTimeframe - Function that allows to change the timeframe displayed in the concentration plot.
 *
 * @param  {int} seconds New number of seconds for the plot.
 */
function changeConcentrationTimeframe(seconds) {
  const concentrationPlotOptions = {
    series: {
      shadowSize: 0,
      color: 'rgb(0, 188, 212)'
    },
    grid: {
      borderColor: '#f3f3f3',
      borderWidth: 1,
      tickColor: '#f3f3f3'
    },
    lines: {
      fill: true
    },
    yaxis: {
      min: 0,
      max: 100
    },
    xaxis: {
      min: 0,
      max: seconds,
      ticks: [
        [0, seconds + 's ago'],
        [seconds / 4, seconds * 0.75 + "s ago"],
        [seconds / 2, seconds / 2 + "s ago"],
        [seconds * 0.75, seconds * 0.25 + "s ago"],
        [seconds, "now"]
      ]
    }
  };
  const secondsDiff = seconds - concentrationArray.length + 1;
  concentrationTimeframe = seconds;
  if (secondsDiff > 0) {
    for (let i = 0; i < secondsDiff; i++) {
      concentrationArray.unshift([0, 0]);
    }
  } else {
    concentrationArray = concentrationArray.slice(-secondsDiff, concentrationArray.length);
  }
  concentrationPlot = $.plot('#real_time_chart', [{
    data: [0, 0],
    lines: {
      show: true,
      fill: false
    }
  }], concentrationPlotOptions);
  concentrationPlot.draw();
}


/**
 * updateEmotionPie - Function that updates the emotion pie chart of the dashboard.
 *
 * @param  {object} emotionCounters Object with emotion counts, manipulated by refreshDashboard().
 */
function updateEmotionPie(emotionCounters) {
  const data = [{
      label: "Happy",
      data: emotionCounters["ha"],
      color: "#f9d000"
    },
    {
      label: "Neutral",
      data: emotionCounters["ne"],
      color: "#888888"
    },
    {
      label: "Sad",
      data: emotionCounters["sa"],
      color: "#0098d2"
    },
    {
      label: "Surprised",
      data: emotionCounters["su"],
      color: "#ff8800"
    },
    {
      label: "Angry",
      data: emotionCounters["an"],
      color: "#7d3c8b"
    },
    {
      label: "Fearful",
      data: emotionCounters["fe"],
      color: "#005CDE"
    },
    {
      label: "Disgust",
      data: emotionCounters["di"],
      color: "#009e2f"
    }
  ]
  emotionPie.setData(data);
  emotionPie.draw();
}


/**
 * removeParticipant - Function that removes a participant with a given id from the participant list on the dashboard.
 *
 * @param  {int} id ID (participantId) of the participant.
 */
function removeParticipant(id) {
  if (document.getElementById(id)) {
    document.getElementById(id).remove();
  };
}


/**
 * setCounterElements - Function that displays the counters in the info tiles.
 *
 * @param  {object} counterElements Object with counters, manipulated by refreshDashboard().
 */
function setCounterElements(counterElements) {
  // apc = activeParticipantCounter, ec = emotionCounter, lacc = lookingAtCameraCounter, mcs = mean concentration score
  const {
    apc,
    ec,
    mcs,
    lacc
  } = counterElements;
  const otherEmotionCounter = ec["an"] + ec["fe"] + ec["di"] + ec["su"];
  const happyPercentage = (apc > 0) ? Math.round(100 * (ec["ha"] / apc)) : 0;
  const neutralPercentage = (apc > 0) ? Math.round(100 * (ec["ne"] / apc)) : 0;
  const sadPercentage = (apc > 0) ? Math.round(100 * (ec["sa"] / apc)) : 0;
  const otherPercentage = (apc > 0) ? Math.round(100 * (otherEmotionCounter / apc)) : 0;
  const lookingPercentage = (apc > 0) ? Math.round(100 * (lacc / apc)) : 0;
  document.getElementById("mean-concentration").innerHTML = mcs + "%";
  document.getElementById("emotion-happy-participants").innerHTML = happyPercentage + "% (" + ec["ha"] + ")";
  document.getElementById("emotion-neutral-participants").innerHTML = neutralPercentage + "% (" + ec["ne"] + ")";
  document.getElementById("emotion-sad-participants").innerHTML = sadPercentage + "% (" + ec["sa"] + ")";
  document.getElementById("emotion-other-participants").innerHTML = otherPercentage + "% (" + otherEmotionCounter + ")";
  document.getElementById("nr-participants").innerHTML = apc;
  document.getElementById("nr-looking-at-camera").innerHTML = lookingPercentage + "% (" + lacc + ")";
}

function sendGoodbyeText(newGoodbyeText){
  webSocket.send(JSON.stringify({
    datatype: "goodbye-text",
    goodbyeText: newGoodbyeText
  }))
}

function sendSurveyURL(newSurveyURL){
  webSocket.send(JSON.stringify({
    datatype: "survey-url",
    surveyURL: newSurveyURL
  }))
}


/**
 * initializeCharts - Function that initializes the concentration plot and emotion pie chart.
 *
 * @return {array}  Concentration plot and pie chart references.
 */
function initializeCharts() {
  const concentrationPlotOptions = {
    series: {
      shadowSize: 0,
      color: 'rgb(0, 188, 212)'
    },
    grid: {
      borderColor: '#f3f3f3',
      borderWidth: 1,
      tickColor: '#f3f3f3'
    },
    lines: {
      fill: true
    },
    yaxis: {
      min: 0,
      max: 100
    },
    xaxis: {
      min: 0,
      max: 100,
      ticks: [
        [0, '100s ago'],
        [25, "75s ago"],
        [50, "50s ago"],
        [75, "25s ago"],
        [100, "now"]
      ]
    }
  };
  const concentrationPlot = $.plot('#real_time_chart', [{
    data: [0, 0],
    lines: {
      show: true,
      fill: false
    }
  }], concentrationPlotOptions);
  concentrationPlot.draw();
  const emotionPieOptions = {
    series: {
      pie: {
        radius: 100,
        show: true,
        label: {
          show: true,
          background: {
            color: '#000'
          }
        }
      }
    },
    legend: {
      show: false
    },
    grid: {
      hoverable: true
    }
  };
  const emotionPie = $.plot('#pie_chart', [
    []
  ], emotionPieOptions);
  emotionPie.draw();
  return [concentrationPlot, emotionPie];
};
