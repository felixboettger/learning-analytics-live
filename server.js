//jshint esversion:6

// --- Imports---

const dotenv = require("dotenv").config();
const fs = require("fs");
const express = require("express");
const session = require('express-session');
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const http = require("http");
const https = require("https");
const WebSocketServer = require("websocket").server;

const laCalc = require("./src/la-calculations")
const laMain = require("./src/la-main")
const laHelp = require("./src/la-helpers")
const laDB = require("./src/la-database")

// --- Configs ---

const updateInterval = process.env.UPDATE_INTERVAL;
const portNr = process.env.PORT;
const localEnv = ("true" === process.env.LOCAL_ENV) ? true : false;

// --- Objects ---

const socketDict = {}; // Open sockets are referenced in this object

// --- Express Setup ---

const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(express.json({limit: "1mb"}));
app.use(cookieParser());
app.use(session({resave: false,
  saveUninitialized: false,
  secret: laHelp.generateSecret(8),
  cookie : {
    secure: true,
    sameSite: 'strict'
  }}));

// --- HTTP Get Request Handlers

app.get("/", function(req, res) {
  res.render("home");
});

app.get("/host", function(req, res) {
  laHelp.checkSession(req.cookies.sessionKey, req.cookies.secret).then(exists => {
    if (exists) {
      res.render("dashboard");
    } else {
      res.render("host");
    }
  });
});

app.get("/dashboard", function(req, res) {
  const [sessionKey, secret] = laMain.createSession();
  const url = req.protocol + "://" + req.get("host") + "/join/" + sessionKey;
  res.cookie("sessionKey", sessionKey);
  res.cookie("secret", secret);
  res.render("dashboard");
});

app.get("/participant", function(req, res) {
  laHelp.checkParticipant(req.cookies.sessionKey, req.cookies.secret, req.cookies.participantId).then(exists => {
    if (exists){
      res.render("client");
    } else {
      res.render("participant");
    }
  });
});

// Join with direct link
app.get("/join/:sessionKey", function(req, res) {
  res.cookie("sessionKey", req.params.sessionKey);
  res.redirect("/participant");
});

app.get("/about", function(req, res) {
  res.render("about");
});

app.get("/legal", function(req, res) {
  res.render("legal-notice");
});

// // --- HTTP Post Request Handlers


// Creation of new participant
app.post("/participant", function(req, res) {
  laMain.createParticipant(req.body.sessionKey, req.body.participantName).then((participant) => {
    if (participant === undefined) {
      res.render("client-session-not-found", {sessionKey: req.body.sessionKey});
    } else {
      res.cookie("sessionKey", req.body.sessionKey);
      res.cookie("participantName", req.body.participantName);
      res.cookie("participantId", participant[0]);
      res.cookie("secret", participant[1]);
      res.render("client");
    }
  });
});

function closeClientSockets(sessionKey){
  const clientSockets = socketDict[sessionKey].clients;
  clientSockets.forEach(clientSocket => clientSocket.close());
}

// --- Server setup and start

// Running server as actual server, with security etc
if (!localEnv) {
  // https server for running the actual communication, serving the website etc.
  server = https
    .createServer(
      {
        key: fs.readFileSync(process.env.SSL_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT),
        ca: fs.readFileSync(process.env.SSL_CHAIN)
      },
      app
    )
    .listen(portNr, function() {
      console.log("Server started on Port: " + portNr);
    });

  // This Server is used to forward incoming http requests to https to enable encrypted data transfer
  http
    .createServer(function(req, res) {
      res.writeHead(301, {
        Location: "https://" + req.headers["host"] + req.url
      });
      res.end();
    })
    .listen(80);
}

// Running the server locally for development or testing, no security etc.
if (localEnv) {
  server = app.listen(portNr, function() {
    console.log("Server started on Port: " + 443);
  });
}

webSocketServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});


webSocketServer.on("request", function(req){
  const type = req.resourceURL.query.type;
  if (type === "dashboard") {
    handleDashboardSocket(req);
  } else if (type === "client") {
    handleClientSocket(req);
  }
});

// --- Web Socket Request Handling ---

function handleDashboardSocket(req){
  laHelp.checkSocketConnect(req).then(isValid => {
    if (!(isValid)) {
      req.reject();
      return;
    } else {
      const sessionKey = req.resourceURL.query.sessionKey;
      const connection = req.accept('echo-protocol', req.origin);
      socketDict[sessionKey] = {host: connection, clients: []};
      var timeStampId = 0;
      const refreshIntervalId = setInterval(function(){
        timeStampId ++;
        laDB.getSessionData(sessionKey).then(sessionData => {
          connection.send(JSON.stringify({datatype: "counters", data: laCalc.generateCounterElements(sessionData)}));
          connection.send(JSON.stringify({datatype: "participants", data: laCalc.generateParticipants(sessionData)}));
        });
        socketDict[sessionKey].clients.forEach(clientSocket => {
          clientSocket.send(JSON.stringify({datatype: "request", id: timeStampId}));
        })
      }, updateInterval)
    connection.on("message", function(message){
      if (message.type === 'utf8') {
          const request = message.utf8Data;
          if (request === "download"){
            laDB.exportSessionData(sessionKey
            ).then(exportData => {
              connection.send(JSON.stringify({datatype: "download", data: exportData}));
            });
          }
      }
    });
    connection.on("close", function(){
      clearInterval(refreshIntervalId);
      closeClientSockets(sessionKey);
      laDB.deleteSession(sessionKey);
      delete socketDict[sessionKey];
      console.log("Connection closed!");
    });
  }})
}

function handleClientSocket(req){
  laHelp.checkSocketConnect(req).then(isValid => {
    if (!(isValid)) {
      req.reject();
      return;
    } else {
      const connection = req.accept('echo-protocol', req.origin);
      const sessionKey = req.resourceURL.query.sessionKey;
      const userId = req.resourceURL.query.userId;
      const indexOfSocket = socketDict[sessionKey].clients.push(connection) - 1;
      connection.on("message", function(message){
        const messageJSON = JSON.parse(message.utf8Data);
        const datatype = messageJSON.datatype;
        if (datatype === "status"){
          const statusVector = messageJSON.data;
          laDB.updateParticipantStatus(sessionKey, userId, statusVector);
        } else if (datatype === "comment") {
          const [comment, timeStampId, time] = [messageJSON.data.te, messageJSON.data.id, new Date().getTime()];
          socketDict[sessionKey].host.send(JSON.stringify({datatype: "comment", data: {te: comment, id: timeStampId, ti: time}}));
          laDB.updateComments(comment, time, timeStampId, sessionKey);
        }
      })
      connection.on("close", function(){
        if (socketDict[sessionKey]){
          socketDict[sessionKey].clients.splice(indexOfSocket, 1);
        }
        laDB.markParticipantAsInactive(sessionKey, userId);
      });
      }
    });
}
