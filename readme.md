This is a prototypical implementation of a Learning Analytics Live Data Collection Tool implemented as part of my Bachelor-Thesis.

*If you deploy this program, don't forget to update the information in the legal section. This program comes with absolutely no warranty, use at your own risk! You are responsible to make sure that your instance complies with the laws in your country. The privacy and legal pages are not to be used as templates and are not legal advice.*

The server program can be executed in the runtime environment "Node.js".

To create a server, the following steps must be performed:

### 1. Download of the tool

For a download via command line (git needs to be installed):

`$ git clone https://github.com/felixboettger/learning-analytics-live`

Alternatively, the program files can be downloaded as a ZIP and then unpacked:

https://github.com/felixboettger/learning-analytics-live/archive/refs/heads/master.zip


### 2. Installation of Node.js and Node Package Manager

Now the JavaScript runtime Node.js must be installed.

For Windows and MacOS, an installer is available on the official website:

https://nodejs.org/en/download/

The installation on Linux-based servers depends on the distribution used. The installation on Linux is described for Ubuntu 20.04 / Ubuntu Server 20.04 as an example:

`$ sudo apt update`
`$ sudo apt install nodejs npm`

### 3. Installation of the MongoDB Server

The server needs access (read and write permissions) to a MongoDB database. The database can either be self-hosted or MongoDB Atlas can be used (paid managed server for MongoDB).

For Windows and MacOS, an installer is available on the official website:

https://docs.mongodb.com/manual/installation/

The installation on Linux-based servers again depends on the distribution used. For Ubuntu / Ubuntu Server, the installation is described here:

https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/

### 4. Installation of the required node modules

The server uses a set of node modules, which can be installed using npm. To do this, use the command line to change the working directory to the downloaded server files. In most cases, the command for is:

`$ cd /PATH/TO/FOLDER`

where /PATH/TO/FOLDER is the folder path.

If you are in the correct working directory, use the following command:

`$ npm ci`

### 5. Setting of environment variables

The server needs some environment variables. These can be provided by means of an .env file.

Create a file with the name ".env" (no file type extension).

The following environment variables must be defined in this file:
```
DB_HOST=
DB_HOST_LOCAL=
SSL_CERT=
SSL_CHAIN=
SSL_KEY=
PORT=
LOCAL_ENV=
UPATE_INTERVAL=
SECRET=
KEEP_INACTIVE_FOR=
TESTING=
```

DB_HOST and DB_HOST_LOCAL are assigned a MongoDB URL. DB_HOST is used if LOCAL_ENV is set to false, DB_HOST_LOCAL is used if it is set to true. In case the MongoDB server is installed on the same machine, it is usually not necessary to specify the user account. In this case the following URL can be used:

mongodb://localhost:27017/mmlaDB

If the MongoDB Server is installed on another machine, you may need to provide the credentials for a MongoDB user with read/write access. Username and password can be encoded in the URL:

mongodb://USERNAME:PASSWORD@MONGODBURL/mmlaDB

The part after the slash is freely choosable and determines the name of the database.

SSL_CERT, SSL_CHAIN and SSL_KEY each expect the path of the following SSL files:

cert.pem
chain.pem
privkey.pem

PORT needs to be initialized with the port number that the server should run on. If it is a self-hosted server, this port can normally be freely selected. The recommended default port for HTTPS is 443. If you are using a v-server, the port may be assigned by the hoster. In this case please enter the assigned port.

LOCAL_ENV should be set to true to test the environment locally without encryption and certificates. For actual deployment, the variable must be set to false.

UPDATE_INTERVAL can be used to change the interval in which (1) student data is extracted by Machine Learning and sent to the server, and (2) session data is sent to the dashboard. The update interval is set in milliseconds, e.g. for an update interval of one second (1Hz), specify 1000 here.

KEEP_INACTIVE_FOR sets the time (in Minutes) that a session is kept alive on the server after the last dashboard access. All inactive sessions that were not accessed in this timeframe are closed and all information erased from the database.

SECRET should be initialized to a long hexadecimal number. The secret is used for cookie and session validation.

TESTING can be set to true to allow loading the load simulation page.

For the instance "mmlatool.de" (for demonstration purposes), the .env file looks like this:
```
DB_HOST=mongodb://localhost:27017/mmlaDB
DB_HOST_LOCAL=mongodb://localhost:27017/mmlaDB
SSL_CERT=/etc/letsencrypt/live/mmlatool.de/cert.pem
SSL_CHAIN=/etc/letsencrypt/live/mmlatool.de/chain.pem
SSL_KEY=/etc/letsencrypt/live/mmlatool.de/privkey.pem
PORT=443
LOCAL_ENV=true
UPDATE_INTERVAL=1000
SECRET=E02650E4DAB76496C521EAA43D34B6DF811E8B017C0E90C2D
KEEP_INACTIVE_FOR=30
TESTING=false
```

### 6. Starting the server

When you have completed the installation and configuration, the server can be started.

Make sure that the MongoDB server is running. The MongoDB server can be started by the following command:

`$ mongod`

Now you can start the main server. To do this, make sure you are in the "learning-analytics-live" directory.

The server can now be started by entering the command:

`$ node server.js`

Depending on the system used, it may be necessary to give Node.js or the executing user permission from the system side to bind to the port. By using a user with root privileges this can be circumvented in many cases, in production scenarios this is strongly discouraged for security reasons.

If everything has been installed and configured correctly, the command line should now display the following:

Server started on Port: (your port number as configured in .env)
Connected to DB: (your db host as configured in .env)

The website and thus the platform are now ready for use. Check whether everything is working properly by calling up the corresponding network address or URL with your browser. Again, don't forget to update information in legal and privacy sections.
