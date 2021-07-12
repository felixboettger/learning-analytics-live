//jshint esversion:6

// This module includes all functions that prepare the data for sending it to the dashboard.

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

// generates counters (sent to dashboard)
function generateCounterElements(sessionData) {
  // variables: apc - active pariticpants, lacc - looking at camera, ec - emotions, ha - happy
  // sa - sad, ne - neutral, di - disgusted, fe - fearful, su - surprised, an - angry
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

module.exports = {generateCounterElements, generateParticipants};
