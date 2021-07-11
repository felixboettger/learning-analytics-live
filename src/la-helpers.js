const laDB = require("./la-database");

// Generates a 14 digit session key
function generateSessionKey() {
  const characters = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  var newKey = "";
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 4; j++) {
      newKey += characters[Math.floor(Math.random() * 25)];
    }
    newKey += "-";
  }
  newKey = newKey.slice(0, 14);
  return newKey;
}

async function validateSecret(req){
  const query = {sessionKey: req.query.sessionKey, secret: req.query.secret};
  return checkSessionExists(query);
}

async function checkSocketConnect(req){
  const type = req.resourceURL.query.type;
  const query = (type === "dashboard") ? {sessionKey: req.resourceURL.query.sessionKey, secret: req.resourceURL.query.secret} : {sessionKey: req.resourceURL.query.sessionKey, "participants.participantId": req.resourceURL.query.userId, "participants.secret": req.resourceURL.query.secret};
  const allowed = await laDB.checkSessionExists(query);
  allowed ? console.log("Connection from Dashboard " + req.origin + " allowed") : console.log("Connection from Dashboard " + req.origin + " rejected");
  return allowed;
}

module.exports = {generateSessionKey, checkSocketConnect, validateSecret};
