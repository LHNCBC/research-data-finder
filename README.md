# FHIR Research Data Finder

This is a query tool that allows you search a FHIR server’s resources to select
a cohort of patients, and then pull data for those patients.

## Demo
Try it out on the [demo page](https://lhcforms.nlm.nih.gov/fhir/research-data-finder/).

### Installation, run, build, test and analyze in development environment
1. Install required node packages:

        npm install

2. Run app in development mode (locally):

        npm start

3. Run app in development mode (public, not recommended):

        npm start-public

4. Run app in development mode using production build configuration (locally):

        npm start-dist

5. Run app in development mode using production build configuration (public, not recommended):

        npm start-dist-public

6. Build the app for production

        npm run build

   The generated files are in **public** directory, which can be moved to a production server.


7. Run visual bundle analyzer (calculate uncompressed size)

        npm run analyze

8. Run visual bundle analyzer (calculate gzip size)

        npm run analyze-gzip

9. Run all tests (unit + e2e)

        npm test

10. Run unit tests

        npm run unit

11. Run e2e tests

        npm run e2e

