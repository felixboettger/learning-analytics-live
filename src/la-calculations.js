
// generates counters (used for API requests)
function generateCounterElements(sessionData) {
  var counterElements = {
    apc: 0,
    lacc: 0,
    ec: {
      ha: 0,
      sa: 0,
      ne: 0,
      di: 0,
      fe: 0,
      su: 0,
      an: 0
    },
  };
  if (sessionData.participants.length > 0) {
    sessionData.participants.forEach(function(participant) {
      const currentStatus = participant.participantStatus.pop();
      if (currentStatus != null){
        const currentEmotion = currentStatus.emotion;
        if (!participant.inactive) {
          if (!(currentEmotion === undefined)){
            counterElements.ec[currentEmotion.substring(0,2)] += 1;
          }
          counterElements.apc += 1;
          if (currentStatus.looks) {
            counterElements.lacc += 1;
          }
        }
      }
    });
  }
  return counterElements;
}

// generates a list of participants for use in the dashboard
function generateParticipants(sessionData) {
  participants = [];
  sessionData.participants.forEach(function(participant) {
    participants.push({
      id: participant.participantId,
      n: participant.participantName, // participant name
      i: participant.inactive, // participant inactive bool
      s:
        participant.participantStatus[
          participant.participantStatus.length - 1
          ]
      });
    })
  return participants;
};

module.exports = {generateCounterElements, generateParticipants};
