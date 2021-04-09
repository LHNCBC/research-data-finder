import { Component, OnInit } from '@angular/core';
import { getCurrentDefinitions } from '@legacy/js/search-parameters/common-descriptions';
import { ColumnDescription } from '../../types/column.description';
import { MatDialogRef } from '@angular/material/dialog';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';

/**
 * Component for selecting columns displayed in resource table
 */
@Component({
  selector: 'app-select-columns',
  templateUrl: './select-columns.component.html',
  styleUrls: ['./select-columns.component.less']
})
export class SelectColumnsComponent implements OnInit {
  columns: ColumnDescription[] = [];
  constructor(private dialogRef: MatDialogRef<SelectColumnsComponent>,
              private fhirBackend: FhirBackendService) {}

  ngOnInit(): void {
    // TODO: temporarily using patient columns.
    this.columns = this.fhirBackend.getCurrentDefinitions().resources.Patient.columnDescriptions;
    console.log(this.columns);
  }

  close(): void {
    this.dialogRef.close();
  }
}
