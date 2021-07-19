const path = location.pathname.split("/");
const sessionKey = path[2];
const names = ["Liam", "Olivia", "Noah", "Emma", "Ava", "Sophia", "Charlotte", "Henry",
"Alex", "Azami", "Kamal", "Remi", "Leonardo", "Simone"];
const randomName = names[Math.floor(Math.random() * names.length)];
fetch("/participant", {
  method: "POST",
  body: JSON.stringify({sessionKey: sessionKey, participantName: randomName}),
}).then(res => {
  const cookieValues = document.cookie.split('; ');
  console.log(res);
  const secret = cookieValues.find(row => row.startsWith('psecret=')).split('=')[1];
  const userId = cookieValues.find(row => row.startsWith('participantId=')).split('=')[1];
  const userName = cookieValues.find(row => row.startsWith('participantName=')).split('=')[1];

  const webSocketProtocol = (window.location.protocol === "https:") ? "wss://" : "ws://";
  const webSocket = new WebSocket(webSocketProtocol + document.domain + ":" + location.port + "/?sessionKey=" + sessionKey + "&userId=" + userId + "&psecret=" + secret + "&type=client", "echo-protocol");

  webSocket.onopen = function(){
    console.log("WebSocket connection to server established!");
    console.log("Protocol: " + webSocketProtocol);
    console.log("Sending 'ready' message to server.")
    webSocket.send(JSON.stringify({datatype: "ready"}));
  }

  webSocket.addEventListener("message", function(event){
    const messageJSON = JSON.parse(event.data);
    const datatype = messageJSON.datatype;
    if (datatype === "start") {
      console.log("Server sent start signal!");
      setInterval(statusInterval, messageJSON.interval);
    }
  });

  function statusInterval(){
    getRandomStatus().then(randomStatusVector => {
      if (!(randomStatusVector === undefined)){
        webSocket.send(JSON.stringify({datatype: "status", data: randomStatusVector}));
      }
  });
  }

  async function getRandomStatus(){
    const statusVector = {
      e: getRandomEmotion(), // emotion
      hs: getRandomHappinessScore(), // happiness score
      l: getRandomBool(), // looking bool
      o: getRandomObjectsArray() // objects
    };
    return statusVector;
  }

  function getRandomEmotion(){
    return Math.floor(Math.random() * 7);
  }

  function getRandomHappinessScore(){
    return Math.floor(Math.random() * 101);
  }

  function getRandomBool(){
    return new Boolean(Math.round(Math.random()));
  }

  function getRandomObjectsArray(){
    const nrOfObjects = Math.floor(Math.random() * 6);
    return randomWords(nrOfObjects);
  }

  function randomWords(number){
    const wordsArray = [];
    const objects = ["person", "cat", "bottle", "laptop", "ball", "tv", "clock",
            "wine glass", "cup", "banana", "book", "scissors", "teddy bear"];
    for (let i = 0; i < number; i++){
      wordsArray.push(objects[Math.floor(Math.random() * objects.length)]);
    }
    return wordsArray;
  }
}

);
