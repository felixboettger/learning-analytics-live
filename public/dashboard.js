//jshint esversion:6

const interval = 1000;
const sessionKey = document.getElementById("sessionKey").textContent;
const apiRequest = {sessionKey: sessionKey};
const fetchOptions = {headers: {'Content-Type': 'application/json'},method: "GET"};

function refreshDashboard(){
  refreshCounterElements();
  refreshParticipantList();
}

async function refreshCounterElements(){
  const counters = await fetch("/api/dashboard/counters?sessionKey=" + sessionKey, fetchOptions).then(fetchResult => fetchResult.json());
  const {activeParticipantCounter, emotionCounters, lookingAtCamera} = counters;
  $("#emotion-happy-participants").html(emotionCounters["happy"]);
  $("#emotion-neutral-participants").html(emotionCounters["neutral"]);
  $("#emotion-sad-participants").html(emotionCounters["sad"]);
  $("#emotion-other-participants").html(emotionCounters["angry"] + emotionCounters["fearful"] + emotionCounters["disgusted"] + emotionCounters["surprised"]);
  $("#nr-participants").html(activeParticipantCounter);
  $("#nr-looking-at-camera").html(lookingAtCamera);
}

async function refreshParticipantList(){
  const participants = await fetch("/api/dashboard/participants?sessionKey=" + sessionKey, fetchOptions).then(fetchResult => fetchResult.json());
  participants.forEach(function(participant){
    addOrCreateParticipant(participant);
  });
};

function addOrCreateParticipant(participant){
  $(document).ready(function() {
    const [participantElement, time] = generateParticipantElements(participant);
    if (new Date().getTime() - new Date(time).getTime() < 30000 ? false : true) {
      ($("#" + participant.id)).remove();
    } else if ($("#" + participant.id).length) {
      $("#" + participant.id).html(participantElement); // does not change acc to score yet
    } else {
      $("tbody").append($('<tr id=' + participant.id + ' class="participant"></tr>').html(participantElement));
    }
  });
}

function generateParticipantElements(participant) {
  const {id, name, status} = participant;
  const {emotionScore, emotion, time, looks, objects} = status; // this accesses the last status
  const htmlParticipantElement = `
    <td>` + emotion + `</td>
    <td>` + name + `</td>
    <td>` + age + `</td>
    <td>` + objects + `</td>
    <td>` + looks + `</td>
    <td>
      <div class="progress">
        <div class="progress-bar bg-green" role="progressbar" aria-valuenow="` + emotionScore + `" aria-valuemin="0" aria-valuemax="100" style="width: ` + emotionScore + `%"></div>
      </div>
    </td>
  `;
  return [htmlParticipantElement, time];
}



setInterval(function() {
  refreshDashboard();
}, interval);
