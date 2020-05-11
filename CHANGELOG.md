# Change Log

This log documents the significant changes for each release.
This project follows [Semantic Versioning](http://semver.org/).

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
