import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import {
  BaseControlValueAccessorAndValidator,
  createControlValueAccessorAndValidatorProviders
} from '../base-control-value-accessor';
import { HttpClient } from '@angular/common/http';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';

/**
 * Settings page component for defining general parameters such as FHIR REST API Service Base URL.
 */
@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.component.html',
  styleUrls: ['./settings-page.component.less'],
  providers: createControlValueAccessorAndValidatorProviders(SettingsPageComponent)
})
export class SettingsPageComponent extends BaseControlValueAccessorAndValidator<any> implements OnInit {
  settingsFormGroup: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private fhirBackend: FhirBackendService) {
    super();
  }

  ngOnInit(): void {
    this.settingsFormGroup = this.formBuilder.group({
      serviceBaseUrl: [this.fhirBackend.serviceBaseUrl, Validators.required]
    });

    this.settingsFormGroup.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  /**
   * Update FHIR REST API Service Base URL from input field.
   */
  updateServiceBaseUrl(): void {
    // Get new URL and strip trailing slash if necessary
    const newUrl = this.settingsFormGroup.get('serviceBaseUrl').value
      .replace(/\/$/, '');

    if (this.fhirBackend.serviceBaseUrl !== newUrl) {
      this.fhirBackend.serviceBaseUrl = newUrl;
    }
  }

  validate({value}: FormControl): ValidationErrors | null {
    return this.settingsFormGroup.get('serviceBaseUrl').errors;
  }

  writeValue(obj: any): void {
  }

}
