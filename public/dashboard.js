//jshint esversion:6

const sessionKey = document.getElementById("sessionKey").textContent;
const secret = document.getElementById("secret").textContent;
const fetchOptions = {headers: {'Content-Type': 'application/json'},method: "GET"};

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
    const newRemark = messageJSON.data.text;
    const timeStampId = messageJSON.data.timeStampId;
    const remarkElement = document.createElement("tr");
    remarkElement.innerHTML = `<td>` + newRemark + `</td>
    <td>` + timeStampId + `</td>` + `<td>` + "time" + `</td>`;
    document.getElementById("remark-list").appendChild(remarkElement);
  }
}
);

document.getElementById("download-btn").addEventListener("click", function() {
 webSocket.send("download");
});

document.getElementById("end-btn").addEventListener("click", function() {
 if (confirm("Click ok to end this session. All session data will be deleted from the server.")){
   webSocket.close();
   const url = window.location;
   url.replace(url.protocol + "//" + url.host + "/");
 }
});


document.getElementById("link-btn").addEventListener("click", function() {
  const directLink = document.getElementById("direct-link").textContent;
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

// ---

async function refreshCounterElements(counters){
  const {activeParticipantCounter, emotionCounters, lookingAtCamera} = counters;

  document.getElementById("emotion-happy-participants").innerHTML = emotionCounters["happy"];
  document.getElementById("emotion-neutral-participants").innerHTML = emotionCounters["neutral"];
  document.getElementById("emotion-sad-participants").innerHTML = emotionCounters["sad"];
  document.getElementById("emotion-other-participants").innerHTML = emotionCounters["angry"] + emotionCounters["fearful"] + emotionCounters["disgusted"] + emotionCounters["surprised"];
  document.getElementById("nr-participants").innerHTML = activeParticipantCounter;
  document.getElementById("nr-looking-at-camera").innerHTML = lookingAtCamera;
}

async function refreshParticipantList(participants){
  participants.forEach(function(participant){
    addOrCreateParticipant(participant);
  });
};

function addOrCreateParticipant(participant){

  const [participantElement, i] = generateParticipantElements(participant);
  if (i) {
    //($("#" + participant.id)).remove();
    document.getElementById(participant.id).remove()
  } else if ($("#" + participant.id).length) {
    // $("#" + participant.id).html(participantElement); // does not change acc to score yet
    document.getElementById(participant.id).innerHTML = participantElement;
  } else {
    const newParticipantElement = document.createElement("tr");
    newParticipantElement.setAttribute('id', participant.id);
    newParticipantElement.setAttribute('class', 'participant');
    document.getElementById("participant-list").appendChild(newParticipantElement);
    // $("tbody").append($('<tr id=' + participant.id + ' class="participant"></tr>').html(participantElement));
  }
};



function generateParticipantElements(participant) {
  const {id, n, i, s} = participant;
  const {happinessScore, emotion, looks, objects} = s; // this accesses the last status
  const htmlParticipantElement = `
    <td>` + emotion + `</td>
    <td>` + n + `</td>
    <td>` + "age" + `</td>
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

const beforeUnloadListener = (event) => {
    event.preventDefault();
    return event.returnValue = "Attention! You won't have access to this session if you reload or close the page!";
    };
