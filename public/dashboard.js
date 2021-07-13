//jshint esversion:6

const cookieValues = document.cookie.split('; ');

const sessionKey = cookieValues.find(row => row.startsWith('sessionKey=')).split('=')[1];
const secret = cookieValues.find(row => row.startsWith('secret=')).split('=')[1];
const directLink = window.location.protocol + "//" + window.location.host + "/join/" + sessionKey;
document.getElementById("session-key").innerHTML = sessionKey;

const webSocketProtocol = (window.location.protocol === "https:") ? "wss://" : "ws://";
const webSocket = new WebSocket(webSocketProtocol + document.domain + ":" + location.port + "/?sessionKey=" + sessionKey + "&secret=" + secret + "&type=dashboard", "echo-protocol");

// Websocket listener

webSocket.addEventListener("message", function(event){
  const messageJSON = JSON.parse(event.data);
  const datatype = messageJSON.datatype;
  if (datatype === "counters") {
    refreshCounterElements(messageJSON.data);
  } else if (datatype === "participants") {
    refreshParticipantList(messageJSON.data)
  } else if (datatype === "download"){
    downloadJSONFile(messageJSON.data);
  } else if (datatype === "comment"){
    addCommentToList(messageJSON.data);
  }
});

webSocket.onclose = function(){
  alert("Session has ended. Click ok to go back to the homepage.");
  const url = window.location;
  url.replace(url.protocol + "//" + url.host + "/");
}

// Unload event listener (for warning)

const beforeUnloadListener = (event) => {
    event.preventDefault();
    return event.returnValue = "Attention! You won't have access to this session if you reload or close the page!";
};


// Button event listeners

document.getElementById("comment-list").addEventListener("click",function(evt) {
  const t = evt.target;
  if (t.tagName.toUpperCase() == "TD") {
    const tr = t.parentNode;
    tr.parentNode.removeChild(tr);
  }
});

document.getElementById("download-btn").addEventListener("click", function() {
 webSocket.send("download");
});

document.getElementById("end-btn").addEventListener("click", function() {
 if (confirm("Click ok to end this session. All session data will be deleted from the server.")){
   webSocket.send("end");
   const url = window.location;
   url.replace(url.protocol + "//" + url.host + "/");
 }
});

document.getElementById("link-btn").addEventListener("click", function() {
  navigator.clipboard.writeText(directLink).then(function() {
 }, function(err) {
   console.error('Async: Could not copy text: ', err);
 });
});

document.getElementById("key-btn").addEventListener("click", function() {
  navigator.clipboard.writeText(sessionKey).then(function() {
 }, function(err) {
   console.error('Async: Could not copy text: ', err);
 });
});

// Helper Functions

function addCommentToList(commentObj){
  document.getElementById("nr-comments").innerHTML ++;
  const newComment = commentObj.te;
  const timeStampId = commentObj.id;
  const dateObj = new Date(commentObj.ti);
  const timeStr = dateObj.getHours() + ":" + dateObj.getMinutes() + ":" + dateObj.getSeconds()
  const commentElement = document.createElement("tr");
  commentElement.innerHTML = `<td>` + newComment + `</td>
  <td>` + timeStampId + `</td>` + `<td>` + timeStr + `</td>`;
  document.getElementById("comment-list").appendChild(commentElement);
}

function downloadJSONFile(object){
  const downloadElement = document.createElement("a");
  const date = new Date();
  downloadElement.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(object)));
  downloadElement.setAttribute("download", "Session " + sessionKey + "on " + date);
  downloadElement.click();
}

async function refreshCounterElements(counters){
  // apc = activeParticipantCounter, ec = emotionCounter, lacc = lookingAtCameraCounter
  const {apc, ec, lacc} = counters;
  const otherEmotionCounter = ec["an"] + ec["fe"] + ec["di"] + ec["su"];
  const happyPercentage = (apc > 0) ? 100 * Math.round(ec["ha"] / apc) : 0;
  const neutralPercentage = (apc > 0) ? 100 * Math.round(ec["ne"] / apc) : 0;
  const sadPercentage = (apc > 0) ? 100 * Math.round(ec["sa"] / apc) : 0;
  const otherPercentage = (apc > 0) ? 100 * Math.round(otherEmotionCounter / apc) : 0;
  const lookingPercentage = (apc > 0) ? 100 * Math.round(lacc / apc) : 0;
  document.getElementById("emotion-happy-participants").innerHTML =  happyPercentage + "% (" + ec["ha"] + ")";
  document.getElementById("emotion-neutral-participants").innerHTML = neutralPercentage + "% (" + ec["ne"] + ")";
  document.getElementById("emotion-sad-participants").innerHTML = sadPercentage + "% (" + ec["sa"] + ")";
  document.getElementById("emotion-other-participants").innerHTML = otherPercentage + "% (" + otherEmotionCounter + ")";
  document.getElementById("nr-participants").innerHTML = apc;
  document.getElementById("nr-looking-at-camera").innerHTML = lookingPercentage + "% (" + lacc + ")";
}

async function refreshParticipantList(participants){
  participants.forEach(function(participant){
    addOrCreateParticipant(participant);
  });
};

function addOrCreateParticipant(participant){
  const [participantElement, i] = generateParticipantElements(participant);
  if (i && document.getElementById(participant.id)) {
    document.getElementById(participant.id).remove()
  } else if (document.getElementById(participant.id)) {
    document.getElementById(participant.id).innerHTML = participantElement;
  } else {
    const newParticipantElement = document.createElement("tr");
    newParticipantElement.setAttribute('id', participant.id);
    newParticipantElement.setAttribute('class', 'participant');
    document.getElementById("participant-list").appendChild(newParticipantElement);
  }
};

function generateParticipantElements(participant) {
  const {id, n, i, s} = participant;
  const {happinessScore, emotion, looks, objects} = (s === undefined) ? "undefined" : s; // this accesses the last status
  const htmlParticipantElement = `
    <td>` + n + `</td>
    <td>` + emotion + `</td>
    <td>` + objects + `</td>
    <td>` + looks + `</td>
    <td>
      <div class="progress">
        <div class="progress-bar bg-green" role="progressbar" aria-valuenow="` + happinessScore + `" aria-valuemin="0" aria-valuemax="100" style="width: ` + happinessScore + `%"></div>
      </div>
    </td>
  `;
  return [htmlParticipantElement, i];
}
