import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatStepper } from '@angular/material/stepper';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { SelectColumnsComponent } from '../select-columns/select-columns.component';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import { ColumnDescription } from '../../types/column.description';
import { Subscription } from 'rxjs';

/**
 * The main component provides a wizard-like workflow by dividing content into logical steps.
 */
@Component({
  selector: 'app-stepper',
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.less']
})
export class StepperComponent implements OnInit, OnDestroy {
  @ViewChild('stepper') private myStepper: MatStepper;
  settings: FormControl = new FormControl();
  defineCohort: FormControl = new FormControl();
  columns: ColumnDescription[] = [];
  visibleColumns: ColumnDescription[] = [];
  serverInitialized = false;
  subscription: Subscription;

  constructor(
    public dialog: MatDialog,
    private fhirBackend: FhirBackendService
  ) {
    this.subscription = fhirBackend.initialized$.subscribe(
      (initialized: boolean) => {
        if (!initialized) {
          return;
        }
        this.columns = this.getColumns();
        this.visibleColumns = this.columns.filter((x) => x.visible);
        this.serverInitialized = true;
      }
    );
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private getColumns(): ColumnDescription[] {
    return this.fhirBackend.getColumns('Patient');
  }

  /**
   * Open dialog to manage visible columns
   */
  openColumnsDialog(): void {
    this.columns = this.getColumns();
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.hasBackdrop = true;
    dialogConfig.data = {
      columns: this.columns
    };
    const dialogRef = this.dialog.open(SelectColumnsComponent, dialogConfig);
    dialogRef.afterClosed().subscribe((data: ColumnDescription[]) => {
      if (!data) {
        return;
      }
      this.columns = data;
      this.visibleColumns = this.columns.filter((x) => x.visible);
      window.localStorage.setItem(
        'Patient-columns',
        data
          .filter((x) => x.visible)
          .map((x) => x.element)
          .join(',')
      );
    });
  }
}
