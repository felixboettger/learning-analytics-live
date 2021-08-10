//jshint esversion:6

// This module includes handling functions for most actions on the server.

// --- Imports ---

const laHelp = require("./la-helpers");
const laDB = require("./la-database");

// --- Objects ---

const socketDict = {}; // Open sockets are referenced in this object

// --- Function Definitions ---

/**
 * addClientToSocketDict - Function that adds a client socket to the socket dictionary.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {object} socket Socket object of the client.
 * @return {int} Index of client socket in socket dictionary client array.
 */
function addClientToSocketDict(sessionKey, socket) {
  if (!(sessionKey in socketDict)) {
    socketDict[sessionKey] = {
      clients: []
    }
  }
  return socketDict[sessionKey].clients.push(socket) - 1;
}

/**
 * addHostToSocketDict - Function that adds the host's socket to the socket dictionary
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {object} socket Socket object of the host.
 */
function addHostToSocketDict(sessionKey, socket) {
  if (sessionKey in socketDict) {
    socketDict[sessionKey].host = socket
  } else {
    socketDict[sessionKey] = {
      host: socket,
      clients: []
    };
  }
}

/**
 * checkActiveSession - Function that checks if host or participants are active in a session.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @return {boolean} Boolean if there are active participants or hosts for the session.
 */
function checkActiveSession(sessionKey) {
  return sessionKey in socketDict;
}

/**
 * closeClientSockets - Function that closes all client sockets (on session end).
 *
 * @param  {type} sessionKey Unique session identifier that was generated on session creation.
 */
function closeClientSockets(sessionKey) {
  const clientSockets = getClientSockets(sessionKey);
  clientSockets.forEach(clientSocket => clientSocket.close());
}

/**
 * createParticipant - Function that creates a participant and adds it to the database.
 *
 * @param  {string} name Name that the participant entered when joining.
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @return {array} Array that contains the new ID of the participant and his secret.
 */
async function createParticipant(name, sessionKey) {
  var session = await laDB.getSessionData(sessionKey, false);
  if (session != null) {
    participantId = session.participants.length;
    secret = laHelp.generateSecret(8);
    laDB.addParticipantToSession(participantId, name, secret, sessionKey);
    return [participantId, secret];
  }
}

/**
 * createSession - Function that creates a new session and adds it to the database.
 *
 * @return {array}  Array that contains sessionKey and secret of the new session
 */
function createSession() {
  const sessionKey = laHelp.generateSessionKey();
  const secret = laHelp.generateSecret(8);
  laDB.addSessionToDatabase(secret, sessionKey);
  return [secret, sessionKey]
}

/**
 * endSession - Function that ends a session (closes all connections and deletes it from database.)
 *
 * @param  {type} sessionKey Unique session identifier that was generated on session creation.
 */
function endSession(sessionKey) {
  closeClientSockets(sessionKey);
  delete socketDict[sessionKey];
  laDB.deleteSession(sessionKey);
}

/**
 * getClientSockets - Function that returns all sockets for active clients in the session.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @return {array} Array containing all client socket objects for the given session.
 */
function getClientSockets(sessionKey) {
  return socketDict[sessionKey].clients;
}

/**
 * getHostSocket - Function that returns the host socket from the socket dictionary.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @return {object} Socket Object.
 */
function getHostSocket(sessionKey) {
  return socketDict[sessionKey].host;
}

/**
 * handleClientSocket - Function that handles WebSocket connections from participant/client side
 *
 * @param  {object} req HTTP(s) request object.
 * @param  {int} updateInterval Interval for generation of new status by client, set in .env file.

 */
function handleClientSocket(req, updateInterval) {
  laHelp.checkSocketConnect(req).then(isValid => {
    if (!(isValid)) {
      req.reject();
      return;
    } else {
      const connection = req.accept('echo-protocol', req.origin);
      const sessionKey = req.resourceURL.query.sessionKey;
      const participantId = req.resourceURL.query.participantId;
      const index = addClientToSocketDict(sessionKey, connection);
      const sessionStartTime = laDB.getSessionStartTime(sessionKey);
      connection.on("message", function(message) {
        laDB.changeParticipantInactive(false, sessionKey, participantId);
        const messageJSON = JSON.parse(message.utf8Data);
        const datatype = messageJSON.datatype;
        if (datatype === "status") {
          sessionStartTime.then(sessionStartTime => {
            const statusVector = messageJSON.data;
            const time = Math.floor(new Date().getTime() / 1000) - sessionStartTime;
            laDB.updateParticipantStatus(sessionKey, participantId, statusVector, time);
          });
        } else if (datatype === "comment") {
          const [comment, time] = [messageJSON.data, new Date().getTime()];
          sendToHostSocket(sessionKey, JSON.stringify({
            datatype: "comment",
            data: {
              te: comment,
              ti: time
            }
          }));
          laDB.addCommentToSession(comment, Math.floor(new Date().getTime() / 1000) - sessionStartTime, sessionKey);
        } else if (datatype === "ready") {
          connection.send(JSON.stringify({
            datatype: "start",
            interval: updateInterval
          }));
        }
      });
      connection.on("close", function() {
        if (checkActiveSession(sessionKey)) {
          removeFromSocketDict(sessionKey, index);
        }
        laDB.changeParticipantInactive(true, sessionKey, participantId);
      });
    };
  });
}

/**
 * handleDashboardSocket - Function that handles WebSocket connections from dashboard/host side
 *
 * @param  {object} req HTTP(s) request object
 * @param  {int} updateInterval Interval for updates of the dashboard, set in .env file.
 */
function handleDashboardSocket(req, updateInterval) {
  laHelp.checkSocketConnect(req).then(isValid => {
    if (!(isValid)) {
      req.reject();
      return;
    } else {
      const sessionKey = req.resourceURL.query.sessionKey;
      const connection = req.accept('echo-protocol', req.origin);
      addHostToSocketDict(sessionKey, connection);
      const clientSockets = getClientSockets(sessionKey);
      const refreshIntervalId = setInterval(function() {
        laDB.getParticipantData(sessionKey).then(participantData => {
          connection.send(JSON.stringify({
            datatype: "participants",
            data: participantData
          }));
        });
      }, updateInterval)
      connection.on("message", function(message) {
        if (message.type === 'utf8') {
          const request = message.utf8Data;
          if (request === "download") {
            laDB.exportSessionData(sessionKey).then(exportData => {
              connection.send(JSON.stringify({
                datatype: "download",
                data: exportData
              }));
            });
          } else if (request == "end") {
            clearInterval(refreshIntervalId);
            endSession(sessionKey);
            console.log("Session " + sessionKey + " closed!");
          }
        }
      });
      connection.on("close", function() {
        clearInterval(refreshIntervalId);
      });
    }
  })
}

/**
 * removeFromSocketDict - Function to remove a client from the socket dictionary.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {int} index Index of the client that is to be removed.
 */
function removeFromSocketDict(sessionKey, index) {
  socketDict[sessionKey].clients.splice(index, 1);
}

/**
 * sendToHostSocket - Function that sends a message to the host socket of a session.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {string} message Content of the WebSocket message that will be sent.
 */
function sendToHostSocket(sessionKey, message) {
  if (socketDict[sessionKey].host) {
    socketDict[sessionKey].host.send(message);
  }
}

/**
 * sendParticipantCookies - Function that sends all cookies for participant authentication.
 *
 * @param  {object} res HTTP(s) response object.
 * @param  {type} sessionKey Unique session identifier that was generated on session creation.
 * @param  {type} participantName Name that the participant entered when joining.
 * @param  {type} participantId Unique ID for the participants in respect to their session.
 * @param  {type} psecret Secret that is used to authenticate the participant.
 */
function sendParticipantCookies(res, sessionKey, participantName, participantId, psecret) {
  res.cookie("sessionKey", sessionKey);
  res.cookie("participantName", participantName);
  res.cookie("participantId", participantId);
  res.cookie("psecret", psecret);
}

module.exports = {
  addClientToSocketDict,
  addHostToSocketDict,
  checkActiveSession,
  createParticipant,
  createSession,
  endSession,
  getClientSockets,
  getHostSocket,
  handleClientSocket,
  handleDashboardSocket,
  removeFromSocketDict,
  sendParticipantCookies,
  sendToHostSocket
};
