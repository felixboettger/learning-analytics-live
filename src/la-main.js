//jshint esversion:6

// This module includes functions that are used by the server, but
// that don't interact directly with the database.


// --- Imports ---

const laHelp = require("./la-helpers");
const laDB = require("./la-database");
const laCalc = require("./la-calculations");

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
  if (sessionKey in socketDict){
    socketDict[sessionKey].host = socket
  } else {
    socketDict[sessionKey] = {host: socket, clients: []};
  }
}

function sendToHostSocket(sessionKey, message){
  if (socketDict[sessionKey].host) {
    socketDict[sessionKey].host.send(message);
  }
}

function addClientToSocketDict(sessionKey, socket){
  if (!(sessionKey in socketDict)){
    socketDict[sessionKey] = {clients: []}
  }
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

function sendParticipantCookies(sessionKey, participantName, participantId, psecret){
  res.cookie("sessionKey", sessionKey);
  res.cookie("participantName", participantName);
  res.cookie("participantId", participantId);
  res.cookie("psecret", psecret);
}

function handleDashboardSocket(req, updateInterval){
  laHelp.checkSocketConnect(req).then(isValid => {
    if (!(isValid)) {
      req.reject();
      return;
    } else {
      const sessionKey = req.resourceURL.query.sessionKey;
      const connection = req.accept('echo-protocol', req.origin);
      addHostToSocketDict(sessionKey, connection);
      const clientSockets = getClientSockets(sessionKey);
      const refreshIntervalId = setInterval(function(){
        laDB.getSessionData(sessionKey).then(sessionData => {
          connection.send(JSON.stringify({datatype: "counters", data: laCalc.generateCounterElements(sessionData)}));
          connection.send(JSON.stringify({datatype: "participants", data: laCalc.generateParticipants(sessionData)}));
        });
      }, updateInterval)
    connection.on("message", function(message){
      if (message.type === 'utf8') {
          const request = message.utf8Data;
          if (request === "download"){
            laDB.exportSessionData(sessionKey
            ).then(exportData => {
              connection.send(JSON.stringify({datatype: "download", data: exportData}));
            });
          } else if (request == "end"){
            clearInterval(refreshIntervalId);
            endSession(sessionKey);
            console.log("Session " + sessionKey + " closed!");
          }
      }
    });
    connection.on("close", function(){
      clearInterval(refreshIntervalId);
    });
  }})
}

function handleClientSocket(req, updateInterval){
  laHelp.checkSocketConnect(req).then(isValid => {
    if (!(isValid)) {
      req.reject();
      return;
    } else {
      const connection = req.accept('echo-protocol', req.origin);
      const sessionKey = req.resourceURL.query.sessionKey;
      const userId = req.resourceURL.query.userId;
      const index = addClientToSocketDict(sessionKey, connection);
      const sessionStartTime = laDB.getSessionStartTime(sessionKey);
      connection.on("message", function(message){
        laDB.markParticipantAsActive(sessionKey, userId);
        const messageJSON = JSON.parse(message.utf8Data);
        const datatype = messageJSON.datatype;
        if (datatype === "status"){
          sessionStartTime.then(sessionStartTime => {
            const statusVector = messageJSON.data;
            const time = Math.floor(new Date().getTime()/1000) - sessionStartTime;
            laDB.updateParticipantStatus(sessionKey, userId, statusVector, time);
          });
        } else if (datatype === "comment") {
            const [comment, time] = [messageJSON.data.te, new Date().getTime()];
            sendToHostSocket(sessionKey, JSON.stringify({datatype: "comment", data: {te: comment, ti: time}}));
            laDB.updateComments(comment, time, sessionKey);
          } else if (datatype === "ready"){
            connection.send(JSON.stringify({datatype: "start", interval: updateInterval}));
          }
      });
      connection.on("close", function(){
        if (checkActiveSession(sessionKey)){
          removeFromSocketDict(sessionKey, index);
        }
        laDB.markParticipantAsInactive(sessionKey, userId);
      });
    };
  });
}


module.exports = {createParticipant, createSession, addClientToSocketDict, sendParticipantCookies,
                  addHostToSocketDict, checkActiveSession, handleClientSocket, handleDashboardSocket,
                  getClientSockets, getHostSocket, sendToHostSocket, removeFromSocketDict, endSession};
