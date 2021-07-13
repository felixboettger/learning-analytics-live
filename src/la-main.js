//jshint esversion:6

// This module includes functions that are used by the server, but
// that don't interact directly with the database.


// --- Imports ---

const laHelp = require("./la-helpers");
const laDB = require("./la-database");

// --- Objects ---

const socketDict = {}; // Open sockets are referenced in this object

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

function checkActiveSession(sessionKey){
  return sessionKey in socketDict;
}

function getHostSocket(sessionKey){
  return socketDict[sessionKey].host;
}

function getClientSockets(sessionKey){
  return socketDict[sessionKey].clients;
}

function addHostToSocketDict(sessionKey, socket){
  socketDict[sessionKey] = {host: socket, clients: []};
}

function addClientToSocketDict(sessionKey, socket){
  return socketDict[sessionKey].clients.push(socket) - 1;
}

function removeFromSocketDict(sessionKey, index){
  socketDict[sessionKey].clients.splice(index, 1);
}

function closeClientSockets(sessionKey){
  const clientSockets = getClientSockets(sessionKey);
  clientSockets.forEach(clientSocket => clientSocket.close());
}

function endSession(sessionKey){
  closeClientSockets(sessionKey);
  delete socketDict[sessionKey];
  laDB.deleteSession(sessionKey);
}

module.exports = {createParticipant, createSession, addClientToSocketDict, addHostToSocketDict, checkActiveSession, getClientSockets, getHostSocket, removeFromSocketDict, endSession};
