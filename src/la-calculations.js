//jshint esversion:6

// This module includes all functions that prepare the data for sending it to the dashboard.

// generates a list of participants for use in the dashboard
function generateParticipants(sessionData) {
  participants = (sessionData[0] != undefined) ? sessionData[0].participants : [];
  return participants;
};

// generates counters (sent to dashboard)
function generateCounterElements(sessionData) {
  // variables: apc - active pariticpants, lacc - looking at camera, ec - emotions,
  // mhc - mean happiness counter, ha - happy sa - sad, ne - neutral, di - disgusted,
  // fe - fearful, su - surprised, an - angry
  var counterElements = {
    apc: 0, lacc: 0, mhc: 0,
    ec: {"ha": 0, "sa": 0, "ne": 0, "di": 0, "fe": 0, "su": 0, "an": 0},
  };
  if (sessionData[0] != undefined){
  sessionData[0].participants.forEach(function(participant) {
      const currentStatus = participant.currentStatus;
      if (currentStatus.emotion != undefined){
        const currentEmotion = currentStatus.emotion;

        if (!(currentEmotion === undefined)){
          counterElements.ec[currentEmotion.substr(0,2)] += 1;
        }
        counterElements.apc += 1;
        counterElements.lacc += (currentStatus.looks) ? 1 : 0;
        counterElements.mhc += currentStatus.happinessScore;
      }
    });
  };
  if (counterElements.apc > 0){
    counterElements.mhc = Math.round(counterElements.mhc/counterElements.apc);
  }
  return counterElements;
}

module.exports = {generateCounterElements, generateParticipants};
