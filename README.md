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
