//jshint esversion:6

// This module includes all functions that prepare the data for sending it to the dashboard.

// --- Function Definitions ---

/**
 * generateCounterElements - Function that generates counters (cross participant statistics)
 *
 * @param  {object} participantData Data of all active participants in the session.
 * @return {object} Object that contains all counter values.
 */
function generateCounterElements(participantData) {
  // variables: apc - active pariticpants, lacc - looking at camera, ec - emotions,
  // mcs - mean concentration score, ha - happy sa - sad, ne - neutral, di - disgusted,
  // fe - fearful, su - surprised, an - angry
  var counterElements = {
    apc: 0, lacc: 0, mcs: 0,
    ec: {"ha": 0, "sa": 0, "ne": 0, "di": 0, "fe": 0, "su": 0, "an": 0},
  };
  try {
    participantData.forEach(function(participant) {
        const currentStatus = participant.currentStatus;
        if (currentStatus.emotion != undefined){
          const currentEmotion = currentStatus.emotion;

          if (!(currentEmotion === undefined)){
            counterElements.ec[currentEmotion.substr(0,2)] += 1;
          }
          counterElements.apc += 1;
          counterElements.lacc += (currentStatus.looks) ? 1 : 0;
          counterElements.mcs += currentStatus.concentrationScore;
        }
      });
    if (counterElements.apc > 0){
      counterElements.mcs = Math.round(counterElements.mcs/counterElements.apc);
    }
    return counterElements;
  } catch (e) {
    return counterElements;
  }


}

// --- Definition of module exports ---

module.exports = {generateCounterElements};
