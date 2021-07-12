//jshint esversion:6

// This module includes functions that are used by the server, but
// that don't interact directly with the database.


// --- Imports ---

const laHelp = require("./la-helpers");
const laDB = require("./la-database");


// ---

function createSession(){
  const newKey = laHelp.generateSessionKey();
  const secret = laHelp.generateSecret(8);
  laDB.addSessionToDatabase(newKey, secret);
  return [newKey, secret]
}

async function createParticipant(sessionKey, name){
  var session = await laDB.getSessionData(sessionKey);
  if (session != null) {
    participantId = session.participants.length;
    secret = laHelp.generateSecret(8);
    laDB.addParticipantToSession(participantId, name, secret, sessionKey);
    return [participantId, secret];
  }
}

module.exports = {createParticipant, createSession};
