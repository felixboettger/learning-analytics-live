This is a prototypical implementation of a Learning Analytics Live Data Collection Tool implemented as part of my Bachelor-Thesis.

--- INSTALLATION ---

To run this tool, first clone the repository. A mongoDB Database is required. If you don't have mongoDB installed, install it by using this link: https://www.mongodb.com/try/download/community

The mongoDB needs to be running before starting the server.

To install required components, navigate to the main folder and run "npm ci".

The server can be run using Node.js via the following command: "node server.js"

For running this software on a remote server, some changes may be necessary (e.g. port number may be assigned by the host).

This project includes code from TensorFlow, face-api ... For License information please review the LICENSES folder.

--- USING THE SOFTWARE ---

Once the software is deployed and running, navigate to the URL. If you run this on your local system, this will be, in most cases, http://localhost:3000. Please note that only you have access to your localhost, to make the platform available for anybody, it needs to be deployed on a server.
