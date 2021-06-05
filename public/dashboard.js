//jshint esversion:6

const path = location.pathname.split("/");
const interval = 500;
const sessionKey = path[2];
const emojiDictionary = {
  "happy": "😀",
  "sad": "☹️",
  "neutral": "😐",
  "disgusted": "🤢",
  "fearful": "😨",
  "surprised": "😲",
  "angry": "😡",
  "cell phone": "📱",
  "laptop": "💻",
  "cat": "🐈",
  "dog": "🐕",
  "sports ball": "⚽",
  "bottle": "🍼",
  "wine glass": "🍷",
  "cup": "🥤",
  "pizza": "🍕",
  "tv": "📺",
  "remote": "🎮",
  "book": "📚",
  "scissors": "✂️",
  "teddy bear": "🧸"
};



const apiRequest = {
  sessionKey: sessionKey,
  secret: "secret"
};
const fetchOptions = {
  headers: {
    'Content-Type': 'application/json'
  },
  method: "POST",
  body: JSON.stringify(apiRequest)
};

// --------------------------------------------------------------------------------------------------------------------------------------
// Counter elements updated by count and reset functions - count different properties for display in dashboard

// emotionCounter is manipulated by countEmotion() and resetEmotionCounter() and is used to keep track how often emotions occur in a session
var emotionCounter = {
  "happy": 0,
  "sad": 0,
  "neutral": 0,
  "disgusted": 0,
  "fearful": 0,
  "surprised": 0,
  "angry": 0
};

// sexCounter is manipulated by countSex() and resetSexCounter() and is used to keep track how many female / male participants are in a session
var sexCounter = {
  "male": 0,
  "female": 0
}

// nrOfActiveParticipants is manipulated by countParticipant() and resetParticipantCounter() and is used to keep track of number of active users
var nrOfActiveParticipants = 0;

// nrLookingAtCamera is manipulated by countLookingAtCamera() and resetLookingAtCameraCounter()
var nrLookingAtCamera = 0;

// --------------------------------------------------------------------------------------------------------------------------------------
// Counting functions are used to manipulate the counter elements above

function countLookingAtCamera(looks){
  if (looks){
    nrLookingAtCamera += 1
  }
}

function resetLookingAtCameraCounter(){
  nrLookingAtCamera = 0;
}

function countParticipant(emotion, gender, looks) {
  nrOfActiveParticipants++;
  countEmotion(emotion);
  countSex(gender);
  countLookingAtCamera(looks)
}

function resetParticipantCounter() {
  nrOfActiveParticipants = 0;
}

function countEmotion(emotion) {
  emotionCounter[emotion] += 1;
}

function resetEmotionCounter() {
  emotionCounter = {
    "happy": 0,
    "sad": 0,
    "neutral": 0,
    "disgusted": 0,
    "fearful": 0,
    "surprised": 0,
    "angry": 0
  };
}

function resetSexCounter() {
  sexCounter = {
    "male": 0,
    "female": 0
  }
}

function countSex(gender) {
  sexCounter[gender] += 1;
}

// --------------------------------------------------------------------------------------------------------------------------------------
// makeApiRequest() is the main loop, first fetches new data from server, then calls the different functions to manipulate the dashboard

async function makeApiRequest(apiRequest) {
  var response = await fetch("/api/dashboard", fetchOptions);
  var body = await response.json(); // .json() is asynchronous and therefore must be awaited
  //console.log(body.response);
  //console.log(body.response.session.participants);
  participants = body.response.session.participants;
  participants.forEach(function(participant) {
    addOrCreateParticipant(participant);
  });
  generateCounterElements();
  resetEmotionCounter();
  resetParticipantCounter();
  resetSexCounter();
  resetLookingAtCameraCounter();

};

// Main loop function above is executed in a certain interval, this interval can be set in the const interval

setInterval(function() {
  makeApiRequest(apiRequest);
}, interval);


// --------------------------------------------------------------------------------------------------------------------------------------

function getRatingOfScore(attentionScore) {
  if (attentionScore > 50) {
    return "good-score";
  } else if (attentionScore > 25) {
    return "neutral-score";
  } else {
    return "bad-score";
  }
}



// --------------------------------------------------------------------------------------------------------------------------------------
// Helper functions that take care of DOM manipulation

// function that is called for every participant, then takes care of updating the DOM accordingly and calling functions to calculate counters
function addOrCreateParticipant(participant, time) {
  $(document).ready(function() {
    const [participantElement, ratingOfScore, time, emotion, gender, looks] = generateParticipantElements(participant);
    if (isTooOld(time)) {
      ($("#" + participant.participantId)).remove();
      // Participant won't be counted as he has been inactive (thus will be removed from list)
    } else if ($("#" + participant.participantId).length) {
      $("#" + participant.participantId).attr("class", ratingOfScore);
      $("#" + participant.participantId).html(participantElement); // does not change acc to score yet
      countParticipant(emotion, gender, looks);
    } else {
      countParticipant(emotion, gender, looks);
      $("tbody").append($('<tr id=' + participant.participantId + ' class="participant ' + ratingOfScore + '"></tr>').html(participantElement));
    }
  });
}

// function that generates HTML element for each single participant and then returns it for use in addOrCreateParticipant()
// Also returns more information about each single participant for further processing
function generateParticipantElements(participant) {
  const {
    participantName,
    participantStatus
  } = participant;
  const {
    attentionScore,
    emotion,
    time,
    age,
    looks,
    objects,
    gender
  } = participantStatus;
  const ratingOfScore = getRatingOfScore(attentionScore);

  const objectsEmojiArray = [];

  objects.forEach(object => {
    objectsEmojiArray.push(emojiDictionary[object]);
  })



  const htmlParticipantElement = `
    <td>` + emojiDictionary[emotion] + `</td>
    <td>` + participantName + `</td>
    <td>` + age + `</td>
    <td>` + objectsEmojiArray + `</td>
    <td>` + looks + `</td>
    <td>
      <div class="progress">
        <div class="progress-bar bg-green" role="progressbar" aria-valuenow="` + attentionScore + `" aria-valuemin="0" aria-valuemax="100" style="width: ` + attentionScore + `%"></div>
      </div>
    </td>
  `;
  return [htmlParticipantElement, ratingOfScore, time, emotion, gender, looks];
}

// generates the counter elements for display in dashboard
function generateCounterElements() {
  const eC = emotionCounter;
  var sexElement = sexCounter["female"] + " / " + sexCounter["male"];
  $("#s-participants").html(sexElement);
  $("#emotion-happy-participants").html(eC["happy"]);
  $("#emotion-neutral-participants").html(eC["neutral"]);
  $("#emotion-sad-participants").html(eC["sad"]);
  $("#emotion-other-participants").html(eC["angry"] + eC["fearful"] + eC["disgusted"] + eC["surprised"]);
  $("#nr-participants").html(nrOfActiveParticipants);
  $("#nr-looking-at-camera").html(nrLookingAtCamera);
}

// --------------------------------------------------------------------------------------------------------------------------------------
// Other helper functions

// checks if a participant in the session has not been update for more then (30s). Used to mark those as inactive and hide them in dashboard
function isTooOld(time) {
  return new Date().getTime() - new Date(time).getTime() < 30000 ? false : true;
  // 3000 is 1000 (ms in a s) * 30 (30 second timeout)
  return tooOld;
}
