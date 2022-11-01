# Change Log

This log documents the significant changes for each release.
This project follows [Semantic Versioning](http://semver.org/).

## [5.1.3] - 2022-11-01
### Added
- Integration with dbGaP power user portal to allow user to login/logout.

## [5.1.2] - 2022-10-27
### Added
- Option to launch a SMART on FHIR connection.

## [5.1.1] - 2022-10-14
### Added
- Search for patients by records in the cart.
- Using the UCUM data from fhirpath.js to display a list of eligible units for
  variables of type Quantity.
### Fixed
- Incorrect stepper state after selecting an action and switching to another
  dbGap server.
- Bug that could cause the patient search to end unexpectedly without any
  notification.
- Optimized patient search by combining ORed code criteria for Observation and
  eliminating unnecessary queries for ANDed criteria.

## [5.1.0] - 2022-10-13
### Added
- Basic RAS flow without actually talking to dbGaP login portal.

## [5.0.17] - 2022-09-30
### Changed
Columns in the table of variables:
- Added a column with the LOINC long common name to the table of variables.
- Renamed column "Variable Name" to "Variable Display Text" in the table of
  variables.

## [5.0.16] - 2022-09-29
### Fixed
- Loss of focus on resource table header cell when sorting table.

## [5.0.15] - 2022-09-29
### Changed
- Added server-side study filtering for the title column of the ResearchStudy table.

## [5.0.14] - 2022-09-29
### Fixed
- No variables after selecting studies.
- Adding studies to the cart affected the list of studies when browsing public
  data.

## [5.0.13] - 2022-09-28
### Added
- Option to limit the ResearchStudy resources to ones the user can access.
### Fixed
- The validation status of the Query Builder component was not updated when
  its configuration was changed. Therefore, the search for patients could not be
  started without changing the criteria.

## [5.0.12] - 2022-09-27
### Added
- Button to download the Research Study or Variable tables into .csv
  files.

## [5.0.11] - 2022-09-12
### Added
- Grouping/ungrouping variables in the cart.
### Fixed
- Pressing the Tab key on the keyboard while the resource table filter button
  had focus was ignored.

## [5.0.10] - 2022-09-01
### Added
- Constraints for variables in the cart.
- Names of studies and datasets to the table of variables.
- A component for displaying text that can be truncated.
- Loading variables when scrolling the table.

### Fixed
- Unnecessary too fast loading of studies in an inactive tab after a 2-minute pause.
- Writing a value to AutocompleteParameterValueComponent.

## [5.0.9] - 2022-08-31
### Added
- Options to variables tab for CTSS API.
### Fixed
- Updating the position of the sticky table header when changing the content of
  the header.

## [5.0.8] - 2022-08-30
### Changed
- Replace mat-autocomplete with autocomplete-lhc controls.
- Match list value on search parameter value autocomplete controls.

## [5.0.7] - 2022-08-29
### Added
- The ability to select multiple rows in a table with a mouse click
  while holding down the Shift key.

## [5.0.6] - 2022-08-26
### Added
- The ability to deselect all selected records.

## [5.0.5] - 2022-08-25
### Added
- Sorting to the variable table (for the alpha version).

## [5.0.4] - 2022-08-25
### Added
- Simple prototype of the component for records in cart for the alpha version.
- The ability to switch to the alpha version using the menu on the version
  number link.
### Fixed
- Incorrect query parameter _type replaced with _format.

## [5.0.3] - 2022-08-24
### Changed
- Removed prev folder.

## [5.0.2] - 2022-07-26
### Fixed
- Do not sort the column when user clicks on header info icon.

## [5.0.1] - 2022-07-22
### Changed
- Use url pattern https://dbgap-api.ncbi.nlm.nih.gov/fhir* for dbGap.

## [5.0.0] - 2022-06-21
### Added
- Alpha version of creating a cohort of patients by browsing and selecting records.

## [4.5.7] - 2022-06-17
### Fixed
- Update criteria data from an old cohort to match current format.
### Added
- Add version number to downloaded cohort.

## [4.5.6] - 2022-06-09
### Fixed
- Use comparators for "string" type search parameters.

## [4.5.5] - 2022-06-01
### Fixed
- Show "display | code | system" for Observation codes that have duplicate display.
- In Observation codes query, include code system.
- Filter out Observation codings with no code in autocomplete.
- Display code if a coding has code but no display.

## [4.5.4] - 2022-05-25
### Fixed
- If user selects Observation "Variable Value" search parameter without
  "Variable Name", show the complete list of numeric and string comparators.

## [4.5.3] - 2022-05-18
### Fixed
- Reinitialize autocomplete field for "variable value" when "variable name"
  changes.
- Incorrect query in some cases:
  * when multiple values are specified in the "variable name" field, and there
    is a "variable value" field.
  * when multiple values are specified in the autocomplete field for
    "variable value".
- Simplified code of resource table component and components that use it.

## [4.5.2] - 2022-05-10
### Fixed
- valueString Observations are not handled.

## [4.5.1] - 2022-05-09
### Fixed
- Fixed exception "expression has changed after it was checked"
  (https://angular.io/errors/NG0100).
- Simplified component code by moving code from components to services.
- Disabled "Save the cohort and criteria for later" button when loading
  a cohort of Patients.

## [4.5.0] - 2022-04-28
### Added
- % complete based on the number of requests processed.
- the ability to set default values for "Requests per batch" and
  "Maximum active requests" in settings.json5 per server and set the default
  value for dbGap to 50.

## [4.4.1] - 2022-04-22
### Fixed
- When requesting Observations, replaced the use of two separate parameters
  "combo-code" and "combo-value-quantity" with a single parameter
  "combo-code-value-quantity".

## [4.4.0] - 2022-04-14
### Added
- Default filter for the "Pull data for the cohort" step.
### Fixed
- Removed duplicate observation codes from requests. Duplication occurs when
  different autocomplete items in the observation lookup component have the
  same codes.

## [4.3.3] - 2022-04-11
### Fixed
- Fixed a bug in the webpack loader that caused the application to build on
  Windows incorrectly.

## [4.3.2] - 2022-04-01
### Changed
- Hide resource table columns without data after loading data.
### Fixed
- The use of a number range filter for the Count column type of
  the ResearchStudy table has been restored.
- Replaced incorrect "dateTime" data type for search parameters with "date"
  to use the correct controls.
- Replaced hyphens in search parameter names with spaces.

## [4.3.1] - 2022-03-31
### Changed
- Hide shared header/footer until page loads.

## [4.3.0] - 2022-03-25
### Added
- Evidence Variable search parameters in define cohort.
- Ability to pull Evidence Variable data for a cohort.

## [4.2.6] - 2022-03-11
### Changed
- get code list for DocumentReference.contenttype via autocomplete search.

## [4.2.5] - 2022-03-08
### Fixed
- Partial hiding of expanded filter lists for research study table.

## [4.2.4] - 2022-03-08
### Changed
- Load shared header and footer from CTSS.

## [4.2.3] - 2022-02-22
### Changed
- Show tooltip if the resource table cell text has been truncated.
- Removed the option to wrap text in resource table cells.

## [4.2.2] - 2022-02-16
### Fixed
- Sorted the dropdown list items for the filter fields in the resource table
  alphabetically.

## [4.2.1] - 2022-02-10
### Changed
- Reduced time to get the first page of research studies.

## [4.2.0] - 2021-02-09
### Changed
- Provided lists for valueCodeableConcept Observations.
### Fixed
- Enabled source map generation.

## [4.1.5] - 2022-02-03
### Changed
- "Keywords" and "Id" for the ResearchStudy table is hidden by default.
- Additional columns with numbers for ResearchStudy table are shown by default
  and renamed.
- Use acronym from Organization reference as a cell value in resource table.
  when available and when it matches the display text.
- Provided the option not to wrap the text in the field.
- Forced "Title" column wider than others for the ResearchStudy table.
- Columns are hidden when we know there is no data for them.

## [4.1.4] - 2022-02-01
### Changed
- Migrated some of the e2e tests to Cypress.

## [4.1.3] - 2022-01-28
### Changed
- Program to update the .xlsx configuration file and updated the .xlsx
  configuration file.

## [4.1.2] - 2022-01-19
### Fixed
- Missing spaces between words in autocomplete dropdown list.

## [4.1.1] - 2022-1-12
### Added
- Support for interpretation search parameter when applicable.

## [4.1.0] - 2021-12-20
### Changed
- Moved comparator, value, and unit to a separate search parameter.

## [4.0.4] - 2021-12-13
### Changed
- Show "Value" column in Observation table by default.

## [4.0.3] - 2021-12-08
### Changed
- Query Builder widget:
  - Add color to the AND/OR lines.
  - Radio buttons to switch between AND/OR operators.
  - Remove "OR" option for single-resource criteria.
  - Added AND/OR above connecting lines.
  - Hide AND/OR toggle when there is only one condition.

## [4.0.2] - 2021-12-6
### Added
- Program to store lists with non-required binding.
### Changed
- Observation.category search parameter in default server now uses a
  autocomplete-lhc Prefetch control with values updated by above program.

## [4.0.1] - 2021-12-2
### Changed
- Until authentication is in place for dbGaP, we include the consent
  groups as values for _security.

## [4.0.0] - 2021-11-30
### Added
- Query Builder: search criteria in Define Cohort step now can combine using
  Boolean operators.
### Fixed
- Detecting of the possibility of using the "age-at-event" sorting parameter.
### Changed
- Rename "resource type" to "record type".
- Text changes in define cohort page.

## [3.25.3] - 2021-11-19
### Changed
- Removed Observation.identifier from search parameters.

## [3.25.2] - 2021-11-19
### Changed
- Left match word boundaries when filtering resource type or search
  parameter.

## [3.25.1] - 2021-11-9
### Fixed
- Announce to the user that a new field has appeared after selecting a
  search parameter.

## [3.25.0] - 2021-11-3
### Added
- a "code text" search parameter for each of the resource types with a
  main "code" field.

## [3.24.0] - 2021-11-1
### Changed
- Turned search parameter value autocomplete prefetch into search, for
  lists whose binding is not required, e.g. Observation.category.
- Show example items when the empty control is focused.

## [3.23.0] - 2021-10-27
### Added
- Program to update the .xlsx configuration file for the 'show/hide' value
  (and row colors) of columns, based on the 'show/hide' values of matching
  search parameters.

## [3.22.2] - 2021-10-19
### Added
- Script for start-public task.

## [3.22.1] - 2021-10-19
### Fixed
- The wrong tab highlighted when the dbGaP server was selected.

## [3.22.0] - 2021-10-08
### Added
- Ability for user to use TAB key on a dropdown list to select an item and
  move to next form control.
- Cursor will be focused on the input control of the newly added line after
  user hits "add resource type" or "add search criterion" buttons.

## [3.21.0] - 2021-10-05
### Changed
- Simplified pull data step search criteria, keeping only observation code
  selection criterion.

## [3.20.0] - 2021-09-23
### Added
- A program to automatically determine whether search parameters have data
  on corresponding server and update the .xlsx configuration file for the
  'show/hide' column.

## [3.19.1] - 2021-09-20
### Changed
- Current tab of the stepper will stay highlighted.

## [3.19.0] - 2021-09-14
### Added
- Include word synonyms when querying server for autocompletion.

## [3.18.1] - 2021-09-10
### Fixed
- Adding a new resource tab in the Pull data for cohort step after or when
  loading Observations data threw exceptions that blocked further operation
  of the application.
- Issue with displaying an empty table when changing the active tab in
  the Pull data for cohort step.

## [3.18.0] - 2021-09-09
### Added
- Using XLSX file(s) to configure search parameters and resource table columns.
### Fixed
- Switching to the View Cohort step after loading criteria and cohort.

## [3.17.1] - 2021-09-08
### Changed
- Sort number columns by number in resource table.

## [3.17.0] - 2021-09-08
### Changed
- Updated to Angular version 12.

## [3.16.2] - 2021-09-07
### Changed
- UI updates to make resource table more readable.

## [3.16.1] - 2021-08-30
### Changed
- Preserve filter values when changing column selections, unless the column
  with filters is removed.
- Trigger table filtering after column change.

## [3.16.0] - 2021-08-17
### Added
- Ability to filter number columns by range.

## [3.15.0] - 2021-08-18
### Changed
- Only Research Studies user has access to can be selected.
- By default, all selectable Research Study rows are checked and displayed
  at the beginning of the table.
- Removed "Skip this step" radio button.
- Reduced number of columns shown by default in Research Study table.

## [3.14.3] - 2021-08-17
### Fixed
- Not all criteria were saved while saving cohort and criteria.
- Not all characters were escaped correctly when downloading a CSV file.
- Descriptions of not all criteria were correctly extracted from the specification.

## [3.14.2] - 2021-08-11
### Fixed
- Quantity units should not have units in single quotes.

## [3.14.1] - 2021-08-11
### Fixed
- Autocomplete-lhc dropdown styles.

## [3.14.0] - 2021-08-09
### Added
- Ability to filter column using autocomplete control with a list of
  possible column values to choose from.
### Changed
- Moved the filter into popup modals that you can open by clicking the
  filter icon on table headers.

## [3.13.0] - 2021-08-04
### Added
- Validation for criteria.
### Changed
- Disabled download button until the resource table data has been loaded.
### Fixed
- Slow evaluation of the contents of the resource table cells.

## [3.12.0] - 2021-07-29
### Changed
- Observation search parameter of type "Quantity" now uses the composite
  test value controls.

## [3.11.0] - 2021-07-28
### Added
- List of units for LOINC codes from CTSS.

## [3.10.1] - 2021-07-28
### Changed
- Added descriptions for search parameter names.
- Renamed "Test value prefix" and "Test value modifier" to "Comparator".
- The default comparator for the test value is "=".

## [3.10.0] - 2021-07-28
### Added
- Patient Id column to ResearchStudy table in the step of pulling data
  for cohort

## [3.9.0] - 2021-07-23
### Changed
- Search criteria in Define Cohort step now has categorized structure based
  on resource types.
- "Observation by Test" is now combined into "Observation" resource type
  as parameter name "code text".
- Removed the date fields in "code text" search parameter.

## [3.8.0] - 2021-07-23
### Changed
- Hide Research Study step if server has no Research Study data.

## [3.7.0] - 2021-07-23
### Changed
- Automatically fallback to single requests if batching is not supported.

## [3.6.1] - 2021-07-22
### Changed
- Show Patient id (dbGaP)
- Store visible table columns for each service base URL separately

## [3.6.0] - 2021-07-22
### Added
- Limit list of resources to what has data (dbGaP).
### Fixed
- It was possible to switch to the View cohort step without
  searching for Patients.

## [3.5.1] - 2021-07-22
### Fixed
- README.md

## [3.5.0] - 2021-07-12
### Added
- Functionality to save cohort data and criteria into file.
- Functionality to load cohort data and criteria from file.

## [3.4.1] - 2021-07-06
### Fixed
- Slowness to load Patients from a ResearchStudy.

## [3.4.0] - 2021-07-06
### Added
- When searching for observation codes, the system now tries to match code
  as well as text. A code will be returned if user input matches exactly the
  code, or part of the code text.

## [3.3.0] - 2021-07-06
### Added
- User can now pull data for Patient the same way as other resource types.

## [3.2.0] - 2021-07-02
### Changed
- After user enters a date range value, the application will use that as
  default value for later date range controls. Refreshing page will clear
  the default value.

## [3.1.2] - 2021-06-28
### Added
- User input to define number of resources per patient for all resource types
  in Pull Data step.

## [3.1.1] - 2021-06-24
### Changed
- When user searches for active patients, the application now tries to also
  return patients without the 'active' field defined.

## [3.1.0] - 2021-06-24
### Added
- Filtering of values in the ResearchStudy.condition column by preferred code
  system.
- Columns for research study content (dbGap only).
- Option to filter ResearchStudies if the user has access to their data.
### Fixed
- Detection of columns visible by default.
- Requests to the FHIR server without endpoint - they cannot be combined
  into a batch request.
- Title of the configure columns dialog.

## [3.0.0] - 2021-06-14
### Changed
- The application has been rewritten to use Angular.
- The new application uses a wizard-like workflow - content is divided into
  logical steps.

## [2.6.1] - 2021-05-24
### Fixed
- Speed up initialization by replacing "_sort=date" with "date=gt1000-01-01"
  in the init query which is used to check if sorting Observations by date
  is supported.

## [2.6.0] - 2021-03-08
### Added
- $lastn lookup of Observation codes, when supported
### Fixed
- It was possible to select the same criteria after loading the cohort criteria
- Displaying Observation component values

## [2.5.0] - 2021-02-18
### Added
- ResearchStudy for cohort selection
- Spinner when loading data

## [2.4.0] - 2020-12-18
### Added
- Support for age-at-event search parameter extension
- Display Observation value from component property
- The ability to enter a floating point Observation value in search parameters
- Advanced settings section
### Changed
- Sort Observations by date only if possible

## [2.3.0] - 2020-12-18
### Added
- Handle 429 responses with rate limiting
## Changed
- Resource type field value is empty by default

## [2.2.0] - 2020-12-02
### Added
- Column selection for resource tables
- Allowed non-LOINC codes to be entered in Patient selection criteria
- Added description for each step

## [2.1.0] - 2020-11-19
### Added
- Reuse selection criteria values from the Patient selection area
- Notes to screen reader log when adding/removing elements
### Fixed
- Observation list does not match term after selection

## [2.0.0] - 2020-11-06
### Added
- Save/Load Cohort criteria
- Version number to html page

## [1.15.0] - 2020-10-30
### Added
- Build/Load Cohort (instead of Patient selection)
## Changed
- Allow patients to be selected by Observation codes which do not have
  values provided for them
- Changed the Patient.active parameter input control from a checkbox to
  a radio button group
## Fixed
- Exception that can be thrown after removing a resource type tab
- Results of not all queries were considered when filtering patient resources
- Extra commas in http requests for data needed for resource tabs

## [1.14.0] - 2020-10-16
### Added
- Allowance to choose which resource types users want to see
  for selected patients

## [1.13.0] - 2020-09-08
### Added
- Display of minimum and maximum values that exist in the database
  for a date range criterion
- npm task "show-webpack-treemap" to run webpack-bundle-analyzer
### Changed
- Bundle size reduced by removing moment locales

## [1.12.0] - 2020-08-24
### Changed
- Revised Observation criteria for Patient selection

## [1.11.2] - 2020-08-14
### Fixed
- Issue with parse batch response
- Issue with partial support of Promise in some Edge versions

## [1.11.1] - 2020-08-12
### Fixed
- Duplication of the search criteria component when changing the server
- Batch tuning applies only after server change

## [1.11.0] - 2020-08-03
### Added
- Display that criteria are combined with logical AND
### Fixed
- Issue with value sets that are used more than once

## [1.10.0] - 2020-07-29
### Added
- Allow other resources to be used to select patients

## [1.9.0] - 2020-07-20
### Changed
- Resource ValueSets are built from the FHIR spec downloads

## [1.8.0] - 2020-07-02
### Added
- Allowed searching of any searchable Condition, Observation or MedicationDispense field

## [1.7.0] - 2020-06-16
### Added
- Separate Patient selection section
- Statistical data loading information

## [1.6.0] - 2020-05-14
### Changed
- Allowed searching of any searchable Encounter field

## [1.5.0] - 2020-05-06
### Changed
- Allowed searching of any searchable Patient field
- Added display of data loading time

## [1.4.0] - 2020-04-23
### Changed
- Allowed selection of patients by gender and age

## [1.3.0] - 2020-04-14
### Changed
- Issues queries per each selected patient
- Added the ability to automatically combine requests in a batch
- No cache used for http errors

## [1.2.1] - 2020-04-09
### Changed
- separate configurations for production and development

## [1.2.0] - 2020-04-03
### Changed
- Added output fields

## [1.1.0] - 2020-03-20
### Changed
- Added button to download observations in CSV format.
- Some markup issues fixed

## [1.0.2] - 2019-09-17
### Changed
- Set the default test/category radio button selection to 'test'

## [1.0.1] - 2019-09-10
### Added
- Support for searching by categories.  The category list includes a mixture of
  categories from the Observation category list and the DiagnosticReport
  category list, with a few modifications.
- A cache for the AJAX requests.
