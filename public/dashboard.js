//jshint esversion:6

const [sessionKey, secret] = getCookieValues();
const directLink = getDirectLink();
const webSocket = createWebSocket(sessionKey, secret);

// --- Event Listeners ---

// WebSocket

webSocket.addEventListener("message", function(event){
  const messageJSON = JSON.parse(event.data);
  const datatype = messageJSON.datatype;
  if (datatype === "participants") {
    refreshDashboard(messageJSON.data);
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

// Buttons

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


// --- Function Definitions ---

function addCommentToList(commentObj){
  document.getElementById("nr-comments").innerHTML ++;
  const newComment = commentObj.te;
  const dateObj = new Date(commentObj.ti);
  const timeStr = dateObj.getHours() + ":" + dateObj.getMinutes() + ":" + dateObj.getSeconds()
  const commentElement = document.createElement("tr");
  commentElement.innerHTML = `<td>` + newComment + `</td><td>` + timeStr + `</td>`;
  document.getElementById("comment-list").appendChild(commentElement);
}

function addOrChangeParticipant(participantElement, id){
  if (document.getElementById(id)) {
    document.getElementById(id).innerHTML = participantElement;
  } else {
    const newTr = document.createElement("tr");
    newTr.setAttribute('id', id);
    newTr.setAttribute('class', 'participant');
    document.getElementById("participant-list").appendChild(newTr);
  }
}

function createWebSocket(sessionKey, secret){
  const wl = window.location;
  const webSocketProtocol = (wl.protocol === "https:") ? "wss://" : "ws://";
  const domain = document.domain;
  const port = location.port;
  const webSocketAddress = webSocketProtocol + domain + ":" + port;
  const sessionKeyParam = "/?sessionKey=" + sessionKey;
  const secretParam = "&hsecret=" + secret ;
  const typeParam = "&type=dashboard";
  const webSocketURL = webSocketAddress + sessionKeyParam + secretParam + typeParam;
  return new WebSocket(webSocketURL, "echo-protocol");
}

function downloadJSONFile(object){
  const downloadElement = document.createElement("a");
  const date = new Date();
  downloadElement.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(object)));
  downloadElement.setAttribute("download", "Session " + sessionKey + "on " + date);
  downloadElement.click();
}

function generateParticipantElement(name, emotion, objects, looks, concentrationScore){
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

function getCookieValues(){
  const cookieValues = document.cookie.split('; ');
  const sessionKey = cookieValues.find(row => row.startsWith('sessionKey=')).split('=')[1];
  const secret = cookieValues.find(row => row.startsWith('hsecret=')).split('=')[1];
  return [sessionKey, secret];
}

function getDirectLink(){
  const wl = window.location;
  return wl.protocol + "//" + wl.host + "/join/" + sessionKey;
}

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
    default:
    return ""
    break;
  }
}

function refreshDashboard(participantsList){
  // variables: apc - active pariticpants, lacc - looking at camera, ec - emotions,
  // mcs - mean concentration score, ha - happy sa - sad, ne - neutral, di - disgusted,
  // fe - fearful, su - surprised, an - angry
  var counterElements = {
    apc: 0, lacc: 0, mcs: 0,
    ec: {"ha": 0, "sa": 0, "ne": 0, "di": 0, "fe": 0, "su": 0, "an": 0},
  };
  participantsList.forEach(function(participant){
    const {inactive, currentStatus, id, name} = participant;
    if (!(inactive)){
      const {concentrationScore, emotion, looks, objects} = (currentStatus === undefined) ? "" : currentStatus;
      if (!(emotion === undefined)){
        counterElements.ec[emotion.substr(0,2)] += 1;
      }
      counterElements.apc += 1;
      counterElements.lacc += (currentStatus.looks) ? 1 : 0;
      counterElements.mcs += currentStatus.concentrationScore;
      const fullEmotion = getFullEmotionName(emotion);
      participantElement = generateParticipantElement(name, fullEmotion, objects, looks, concentrationScore);
      addOrChangeParticipant(participantElement, id);
    } else {
      removeParticipant(id);
    }
  });
  if (counterElements.apc > 0){
    counterElements.mcs = Math.round(counterElements.mcs/counterElements.apc);
  }
  setCounterElements(counterElements);
}

function removeParticipant(id){
  if (document.getElementById(id)) {
    document.getElementById(id).remove();
  };
}

function setCounterElements(counterElements){
  // apc = activeParticipantCounter, ec = emotionCounter, lacc = lookingAtCameraCounter, mcs = mean concentration score
  const {apc, ec, mcs, lacc} = counterElements;
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
