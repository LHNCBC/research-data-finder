import { Component, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatStepper } from '@angular/material/stepper';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { SelectColumnsComponent } from '../select-columns/select-columns.component';

/**
 * The main component provides a wizard-like workflow by dividing content into logical steps.
 */
@Component({
  selector: 'app-stepper',
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.less']
})
export class StepperComponent implements OnInit {
  @ViewChild('stepper') private myStepper: MatStepper;
  settings: FormControl = new FormControl();
  defineCohort: FormControl = new FormControl();

  constructor(public dialog: MatDialog) {}

  ngOnInit(): void {}

  openColumnsDialog(): void {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.minWidth = 800;
    dialogConfig.disableClose = true;
    dialogConfig.hasBackdrop = true;
    const dialogRef = this.dialog.open(SelectColumnsComponent, dialogConfig);
  }
}
