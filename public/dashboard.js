//jshint esversion:6

const cookieValues = document.cookie.split('; ');

const sessionKey = cookieValues.find(row => row.startsWith('sessionKey=')).split('=')[1];
const secret = cookieValues.find(row => row.startsWith('hsecret=')).split('=')[1];
const directLink = window.location.protocol + "//" + window.location.host + "/join/" + sessionKey;
document.getElementById("session-key").innerHTML = sessionKey;

const webSocketProtocol = (window.location.protocol === "https:") ? "wss://" : "ws://";
const webSocket = new WebSocket(webSocketProtocol + document.domain + ":" + location.port + "/?sessionKey=" + sessionKey + "&hsecret=" + secret + "&type=dashboard", "echo-protocol");

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
    return event.returnValue = "Please confirm to leave the session!";
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
  const dateObj = new Date(commentObj.ti);
  const timeStr = dateObj.getHours() + ":" + dateObj.getMinutes() + ":" + dateObj.getSeconds()
  const commentElement = document.createElement("tr");
  commentElement.innerHTML = `<td>` + newComment + `</td><td>` + timeStr + `</td>`;
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
  // apc = activeParticipantCounter, ec = emotionCounter, lacc = lookingAtCameraCounter, mcs = mean concentration score

  const {apc, ec, mcs, lacc} = counters;
  const otherEmotionCounter = ec["an"] + ec["fe"] + ec["di"] + ec["su"];
  const happyPercentage = (apc > 0) ? Math.round(100 * (ec["ha"] / apc)) : 0;
  const neutralPercentage = (apc > 0) ? Math.round(100 * (ec["ne"] / apc)) : 0;
  const sadPercentage = (apc > 0) ? Math.round(100 * (ec["sa"] / apc)) : 0;
  const otherPercentage = (apc > 0) ? Math.round(100 * (otherEmotionCounter / apc)) : 0;
  const lookingPercentage = (apc > 0) ? Math.round(100 * (lacc / apc)) : 0;
  document.getElementById("mean-concentration").innerHTML = mcs;
  document.getElementById("emotion-happy-participants").innerHTML =  happyPercentage + "% (" + ec["ha"] + ")";
  document.getElementById("emotion-neutral-participants").innerHTML = neutralPercentage + "% (" + ec["ne"] + ")";
  document.getElementById("emotion-sad-participants").innerHTML = sadPercentage + "% (" + ec["sa"] + ")";
  document.getElementById("emotion-other-participants").innerHTML = otherPercentage + "% (" + otherEmotionCounter + ")";
  document.getElementById("nr-participants").innerHTML = apc;
  document.getElementById("nr-looking-at-camera").innerHTML = lookingPercentage + "% (" + lacc + ")";
}

async function refreshParticipantList(participants){
  const participantsInList = document.getElementsByClassName("participant");
  const participantIdsInList = [];
  for (let element of participantsInList) {
    participantIdsInList.push(parseInt(element.id));
  }
  participants.forEach(function(participant){
    const id = addOrCreateParticipant(participant);
    const index = participantIdsInList.indexOf(id);
    if (index !== -1) {
      participantIdsInList.splice(index, 1);
    }
  });
  participantIdsInList.forEach(id => document.getElementById(id).remove());
};

function addOrCreateParticipant(participant){
  const participantElement = generateParticipantElements(participant);
  if (document.getElementById(participant.id)) {
    document.getElementById(participant.id).innerHTML = participantElement;
  } else {
    const newParticipantElement = document.createElement("tr");
    newParticipantElement.setAttribute('id', participant.id);
    newParticipantElement.setAttribute('class', 'participant');
    document.getElementById("participant-list").appendChild(newParticipantElement);
  }
  return participant.id;
};

function generateParticipantElements(participant) {
  const {currentStatus, id, name} = participant;
  const {concentrationScore, emotion, looks, objects} = (currentStatus === undefined) ? "undefined" : currentStatus; // this accesses the last status
  const htmlParticipantElement = `
    <td>` + name + `</td>
    <td>` + getFullEmotionName(emotion) + `</td>
    <td>` + objects + `</td>
    <td>` + looks + `</td>
    <td>
      <div class="progress">
        <div class="progress-bar bg-green" role="progressbar" aria-valuenow="` + concentrationScore + `" aria-valuemin="0" aria-valuemax="100" style="width: ` + concentrationScore + `%"></div>
      </div>
    </td>
  `;
  return [htmlParticipantElement];
}

const emotionList = ["happy", "neutral", "sad", "fearful", "disgusted", "angry", "surprised"];

function getFullEmotionName(emotion){
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
  }
}
