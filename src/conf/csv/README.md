# CSV Format for Resource Definition

This folder contains resource definition CSV files used by the RDF webapp and
autoconfig CLI (for example `desc-default-R4.csv` and `desc-default-R5.csv`).

Each CSV row has eight columns:

1. `resourceType`
2. `element`
3. `rowType`
4. `displayName`
5. `hideShow`
6. `type`
7. `expression`
8. `description`

## Row types

### Resource header row

Starts a new resource block.

- `resourceType`: required (for example `Observation`)
- Other columns: empty

Example:

```csv
Observation,,,,,,,
```

### Search parameter row

Defines one searchable criterion for the current resource.

- `resourceType`: empty
- `element`: FHIR search parameter name; can be combined with commas
  (for example `code,medication`)
- `rowType`: `search parameter`
- `displayName`: label used in the UI
- `hideShow`: `show` or `hide` (default visibility)
- `type`: FHIR search parameter type; can be combined with commas to match
  combined `element` values
- `expression`: empty
- `description`: optional

Example:

```csv
,code,search parameter,Code,show,CodeableConcept,,
```

Combined-parameter example:

```csv
,"code,medication",search parameter,Code or Medication,hide,"CodeableConcept,Reference",,The display text associated with the code of the medication being administered
```

### Combined search parameters

For a combined parameter entry (for example `code,medication`), the CSV may
also include separate rows for each individual parameter, and those individual
rows could use `hide` in `hideShow`. In this case, the `type` column of the
combined parameter will be ignored (leave it empty), and the type will be
determined based on each individual parameter.
For example:
```csv
,"code,medication",search parameter,medication name,show,,,The display text associated with the code of the medication being administered
,code,search parameter,code,hide,CodeableConcept,,Returns dispenses of this medicine code
,medication,search parameter,medication,hide,Reference,,Returns dispenses of this medicine resource
```

Having a separate row for each parameter allows for more precise control over
the visibility of each parameter during the auto-configuration phase;
for example, if the server supports only codes, then "code,medication" and
"medication" will be hidden, while "code" will become available.

### Column row

Defines one table column for the current resource.

- `resourceType`: empty
- `element`: resource property path (for example `value[x]`, `subject`)
- `rowType`: `column`
- `displayName`: column title
- `hideShow`: `show` or `hide` (default visibility)
- `type`: one or more FHIR data types (comma-separated for polymorphic fields)
- `expression`: optional FHIRPath expression used for custom column extraction
  and autoconfig empty-column checks
- `description`: optional helper text shown in the UI

Example:

```csv
,value[x],column,Value,show,"Quantity,CodeableConcept,string",,Actual result
```

## Notes

- Rows are grouped by resource header; child rows belong to the nearest header
  above them.
- `rowType` is expected to be only `search parameter` or `column`.
- Search parameters and types are split on commas for combined definitions.
- Do not edit source templates in this folder directly. They are generated
  automatically from the source Excel files in the `src/conf/xlsx` folder.
