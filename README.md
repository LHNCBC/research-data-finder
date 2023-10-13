# FHIR Research Data Finder

This is a query tool that allows you search a FHIR server’s resources to select
a cohort of patients, and then pull data for those patients.

## Demo
Try it out on the [demo page](https://lhcforms.nlm.nih.gov/fhir/research-data-finder/).

## How to run it locally
1. Install required node packages:

        npm install

2. Run app in development mode (locally):

        npm start

## Testing and building
1. Run all tests (unit + e2e)

        npm test

2. Build the app for production

        npm run build

   The generated files are in **public** directory, which can be moved to a production server.


3. Run visual bundle analyzer (calculate uncompressed size)

        npm run analyze

4. Run visual bundle analyzer (calculate gzip size)

        npm run analyze-gzip

## Connecting to a new server that requires OAuth2
If you want to connect to your own OAuth2 server, you will need to
have a server program which holds your client secret and handles OAuth
login calls from RDF. Here is some sample code for the server program,
for the case of a Google Health & Node.js environment:
   1. app.js
   ```JavaScript
   const express = require('express');
   const oauth2Router = require('./routes/oauth2');
   const app = express();
   app.use(express.json());
   app.use(express.urlencoded({extended: true}));
   app.use('/oauth2', oauth2Router);
   module.exports = app;
   ```
   2. oauth2.js (router)
   ```JavaScript
   const express = require('express');
   const router = express.Router();
   const config = require('../config.json');
   const {AuthorizationCode} = require('simple-oauth2');
    const googleHealthClient = new AuthorizationCode({
     client: {
       id: config["google_health_client_id"],
       secret: config["google_health_client_secret"]
     },
     auth: {
      authorizeHost: config["google_health_authorize_host"],
      authorizePath: config["google_health_authorize_path"],
      tokenHost: config["google_health_token_host"],
      tokenPath: config["google_health_token_path"]
     }
   });
   const rdfHostPath = "/fhir/research-data-finder";

   function getCallbackUrl(req) {
     return `${req.protocol}://${req.headers.host}${rdfHostPath}${config["google_health_callback_url"]}`;
   }

   /* Log in. */
   router.get('/login', function (req, res) {
     const authorizationUri = googleHealthClient.authorizeURL({
       redirect_uri: getCallbackUrl(req),
       scope: config["google_health_scope"]
     });
     return res.redirect(authorizationUri);
   });

   /* Callback service parsing the authorization token and asking for the access token. */
   router.get('/callback', async function (req, res) {
     const {code} = req.query;
     const options = {
       code,
       redirect_uri: getCallbackUrl(req)
     };
     try {
       const accessToken = await googleHealthClient.getToken(options);
       return res.status(200).json(accessToken.token);
     } catch (err) {
       const errMsg = 'Authentication failed';
       return res.status(400).send(errMsg);
     }
   });

   module.exports = router;
   ```
   3. config.json
   ```Json
   {
     "google_health_client_id": "my_client_id",
     "google_health_client_secret": "my_client_secret",
     "google_health_authorize_host": "https://accounts.google.com",
     "google_health_authorize_path": "/o/oauth2/v2/auth",
     "google_health_token_host": "https://www.googleapis.com",
     "google_health_token_path": "/oauth2/v4/token",
     "google_health_scope": "https://www.googleapis.com/auth/cloud-platform",
     "google_health_callback_url": "/oauth2-callback"
   }
   ```
