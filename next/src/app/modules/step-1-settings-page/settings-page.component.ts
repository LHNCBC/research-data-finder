import { Component, forwardRef, OnInit } from '@angular/core';
import {
  AsyncValidator,
  FormBuilder,
  FormControl,
  FormGroup,
  NG_ASYNC_VALIDATORS,
  ValidationErrors,
  Validators
} from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import { HttpClient } from '@angular/common/http';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';

/**
 * Settings page component for defining general parameters such as FHIR REST API Service Base URL.
 */
@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.component.html',
  styleUrls: ['./settings-page.component.less'],
  providers: [
    ...createControlValueAccessorProviders(SettingsPageComponent),
    {
      provide: NG_ASYNC_VALIDATORS,
      useExisting: forwardRef(() => SettingsPageComponent),
      multi: true
    }
  ]
})
export class SettingsPageComponent
  extends BaseControlValueAccessor<any>
  implements AsyncValidator, OnInit {
  settingsFormGroup: FormGroup;
  isWaitingForConnection$: Observable<boolean>;

  constructor(
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private fhirBackend: FhirBackendService
  ) {
    super();
    this.isWaitingForConnection$ = fhirBackend.initialized$.pipe(
      map((status) => status === ConnectionStatus.Pending)
    );
  }

  /**
   * Component initialization
   * (See https://angular.io/guide/lifecycle-hooks)
   */
  ngOnInit(): void {
    this.settingsFormGroup = this.formBuilder.group({
      serviceBaseUrl: new FormControl(this.fhirBackend.serviceBaseUrl, {
        validators: Validators.required,
        asyncValidators: this.serviceBaseUrlValidator.bind(this),
        updateOn: 'blur'
      }),
      apiKey: [''],
      maxRequestsPerBatch: [
        this.fhirBackend.maxRequestsPerBatch,
        Validators.required
      ],
      maxActiveRequests: [
        this.fhirBackend.maxActiveRequests,
        Validators.required
      ],
      cacheDisabled: [!this.fhirBackend.cacheEnabled]
    });

    this.settingsFormGroup.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  /**
   * Update FHIR REST API Service configuration parameter from input field by name.
   */
  updateFhirBackendSetting(name: string): void {
    const newValue = this.settingsFormGroup.get(name).value;
    if (this.fhirBackend[name] !== newValue) {
      this.fhirBackend[name] = newValue;
    }
  }

  /**
   * Validates the settings form to allow switch to the next step
   */
  validate(): Observable<ValidationErrors | null> {
    return this.fhirBackend.initialized$.pipe(
      filter((status) => status !== ConnectionStatus.Pending),
      take(1),
      map(() => (this.settingsFormGroup.valid ? null : { invalid: true }))
    );
  }

  /**
   * Updates and validates the server base URL
   * @param control - FormControl instance associated with the input field
   */
  serviceBaseUrlValidator(
    control: FormControl
  ): Observable<ValidationErrors | null> {
    // Update serverBaseUrl
    this.fhirBackend.serviceBaseUrl = control.value.replace(/\/$/, '');

    // Wait for response to validate server
    return this.fhirBackend.initialized$.pipe(
      filter((status) => status !== ConnectionStatus.Pending),
      take(1),
      map((status) =>
        status === ConnectionStatus.Ready ? null : { wrongUrl: true }
      )
    );
  }

  /**
   * Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   */
  writeValue(obj: any): void {}
}
