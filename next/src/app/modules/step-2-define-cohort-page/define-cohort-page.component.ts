import { Component, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  BaseControlValueAccessorAndValidator,
  createControlValueAccessorAndValidatorProviders,
} from '../base-control-value-accessor';
import { SearchParametersComponent } from '../search-parameters/search-parameters.component';

/**
 * Component for defining criteria to build a cohort of Patient resources.
 */
@Component({
  selector: 'app-define-cohort-page',
  templateUrl: './define-cohort-page.component.html',
  styleUrls: ['./define-cohort-page.component.less'],
  providers: createControlValueAccessorAndValidatorProviders(
    DefineCohortPageComponent
  ),
})
export class DefineCohortPageComponent
  extends BaseControlValueAccessorAndValidator<any>
  implements OnInit {
  defineCohortForm: FormGroup;

  @ViewChild('patientParams') patientParams: SearchParametersComponent;

  constructor(private formBuilder: FormBuilder) {
    super();
  }

  ngOnInit(): void {
    this.defineCohortForm = this.formBuilder.group({
      maxPatientsNumber: ['100', Validators.required],
    });
    this.defineCohortForm.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  validate({ value }: FormControl): ValidationErrors | null {
    return this.defineCohortForm.get('maxPatientsNumber').errors;
  }

  writeValue(obj: any): void {}

  addParameter(): void {
    this.patientParams.addParameter();
  }
}
