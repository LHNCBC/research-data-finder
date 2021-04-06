import { Component, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatStepper } from '@angular/material/stepper';

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

  constructor() {}

  ngOnInit(): void {}
}
