import { Component, OnInit } from '@angular/core';
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

/**
 * Settings page component for defining general parameters such as FHIR REST API Service Base URL.
 */
@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.component.html',
  styleUrls: ['./settings-page.component.less'],
  providers: createControlValueAccessorAndValidatorProviders(
    SettingsPageComponent
  ),
})
export class SettingsPageComponent
  extends BaseControlValueAccessorAndValidator<any>
  implements OnInit {
  settingsFormGroup: FormGroup;

  constructor(private formBuilder: FormBuilder) {
    super();
  }

  ngOnInit(): void {
    this.settingsFormGroup = this.formBuilder.group({
      serviceBaseUrl: [
        'https://lforms-fhir.nlm.nih.gov/baseR4',
        Validators.required,
      ],
    });

    this.settingsFormGroup.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  validate({ value }: FormControl): ValidationErrors | null {
    return this.settingsFormGroup.get('serviceBaseUrl').errors;
  }

  writeValue(obj: any): void {}
}
