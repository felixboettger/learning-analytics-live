const laHelp = require("./la-helpers");
const laDB = require("./la-database");

const crypto = require("crypto");

async function createParticipant(sessionKey, name){
  var session = await laDB.getSessionData(sessionKey);
  if (session != null) {
    participantId = session.participants.length;
    secret = crypto.randomBytes(4).toString("hex");
    laDB.addParticipantToSession(participantId, name, secret, sessionKey);
    return [participantId, secret];
  }
}

function createSession(){
  const newKey = laHelp.generateSessionKey();
  const secret = crypto.randomBytes(4).toString("hex");
  laDB.addSessionToDatabase(newKey, secret);
  return [newKey, secret]
}

module.exports = {createParticipant, createSession};
