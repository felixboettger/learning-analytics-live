//jshint esversion:6

const sessionKey = document.getElementById("sessionKey").textContent;
const secret = document.getElementById("secret").textContent;
const fetchOptions = {headers: {'Content-Type': 'application/json'},method: "GET"};
const url = window.location;

console.log(url);

const inactiveList = []

// --- EXPERIMENTAL

const webSocket = new WebSocket("ws://localhost:8080/?sessionKey=" + sessionKey + "&secret=" + secret, "echo-protocol");

webSocket.addEventListener("message", function(event){
  const messageJSON = JSON.parse(event.data);
  const datatype = messageJSON.datatype;
  if (datatype === "counters") {
    refreshCounterElements(messageJSON.data);
  } else if (datatype === "participants") {
    refreshParticipantList(messageJSON.data)
  } else if (datatype === "download"){
    const downloadElement = document.createElement("a");
    const date = new Date();
    downloadElement.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(messageJSON.data)));
    downloadElement.setAttribute("download", "Session " + sessionKey + "on " + date);
    downloadElement.click();
  } else if (datatype === "remark"){
    const newRemark = messageJSON.data;
    const remarkListElement = document.createElement("li");
    remarkListElement.appendChild(document.createTextNode(newRemark));
    document.getElementById("remark-list").appendChild(remarkListElement)
  }
}
);

document.getElementById("downloadBtn").addEventListener("click", function() {
 webSocket.send("download");
});

document.getElementById("endBtn").addEventListener("click", function() {
 confirm("Click ok to end this session. All session data will be deleted from the server.");
 webSocket.close();
 window.location.replace(url.protocol + "//" + url.host + "/");
});

document.getElementById("linkBtn").addEventListener("click", function() {
  const directLink = document.getElementById("direct-link").textContent;
  navigator.clipboard.writeText(directLink).then(function() {
 }, function(err) {
   console.error('Async: Could not copy text: ', err);
 });
});

document.getElementById("keyBtn").addEventListener("click", function() {
  navigator.clipboard.writeText(sessionKey).then(function() {
 }, function(err) {
   console.error('Async: Could not copy text: ', err);
 });
});

// ---

async function refreshCounterElements(counters){
  const {activeParticipantCounter, emotionCounters, lookingAtCamera} = counters;
  $("#emotion-happy-participants").html(emotionCounters["happy"]);
  $("#emotion-neutral-participants").html(emotionCounters["neutral"]);
  $("#emotion-sad-participants").html(emotionCounters["sad"]);
  $("#emotion-other-participants").html(emotionCounters["angry"] + emotionCounters["fearful"] + emotionCounters["disgusted"] + emotionCounters["surprised"]);
  $("#nr-participants").html(activeParticipantCounter);
  $("#nr-looking-at-camera").html(lookingAtCamera);
}

async function refreshParticipantList(participants){
  participants.forEach(function(participant){
    addOrCreateParticipant(participant);
  });
};

function addOrCreateParticipant(participant){
  $(document).ready(function() {
    const [participantElement, inactive] = generateParticipantElements(participant);
    if (inactive) {
      ($("#" + participant.id)).remove();
    } else if ($("#" + participant.id).length) {
      $("#" + participant.id).html(participantElement); // does not change acc to score yet
    } else {
      $("tbody").append($('<tr id=' + participant.id + ' class="participant"></tr>').html(participantElement));
    }
  });
}



function generateParticipantElements(participant) {
  const {id, name, inactive, status} = participant;
  const {emotionScore, emotion, looks, objects} = status; // this accesses the last status
  const htmlParticipantElement = `
    <td>` + emotion + `</td>
    <td>` + name + `</td>
    <td>` + "age" + `</td>
    <td>` + objects + `</td>
    <td>` + looks + `</td>
    <td>
      <div class="progress">
        <div class="progress-bar bg-green" role="progressbar" aria-valuenow="` + emotionScore + `" aria-valuemin="0" aria-valuemax="100" style="width: ` + emotionScore + `%"></div>
      </div>
    </td>
  `;
  return [htmlParticipantElement, inactive];
}

const beforeUnloadListener = (event) => {
    event.preventDefault();
    return event.returnValue = "Attention! You won't have access to this session if you reload or close the page!";
    };
