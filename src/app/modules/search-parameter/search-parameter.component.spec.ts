import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchParameterComponent } from './search-parameter.component';
import { configureTestingModule } from 'src/test/helpers';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MockComponent } from 'ng-mocks';
import {
  SearchParameterValueComponent
} from './search-parameter-value.component';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyAutocompleteModule as MatAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AutocompleteModule } from '../autocomplete/autocomplete.module';
import { RouterTestingModule } from '@angular/router/testing';

class Page {
  private fixture: ComponentFixture<SearchParameterComponent>;
  constructor(fixture: ComponentFixture<SearchParameterComponent>) {
    this.fixture = fixture;
  }
  get compositeTestValue(): DebugElement {
    return this.fixture.debugElement.query(
      By.css('app-search-parameter-value')
    );
  }
}

describe('SearchParameterComponent', () => {
  let component: SearchParameterComponent;
  let fixture: ComponentFixture<SearchParameterComponent>;
  let page: Page;

  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [
          SearchParameterComponent,
          MockComponent(SearchParameterValueComponent)
        ],
        imports: [
          CommonModule,
          MatIconModule,
          ReactiveFormsModule,
          MatButtonModule,
          MatFormFieldModule,
          MatAutocompleteModule,
          MatInputModule,
          NoopAnimationsModule,
          AutocompleteModule,
          RouterTestingModule
        ]
      },
      {
        definitions: {
          resources: {
            Observation: {
              searchParameters: [
                {
                  element: 'code text',
                  displayName: 'Some name'
                },
                {
                  element: 'value-quantity',
                  displayName: 'value quantity',
                  type: 'Quantity'
                },
                {
                  element: 'already-selected',
                  displayName: 'already selected',
                  type: 'string'
                }
              ]
            }
          }
        }
      }
    );
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SearchParameterComponent);
    page = new Page(fixture);
    component = fixture.componentInstance;
    component.resourceType = 'Observation';
    component.selectedSearchParameterNames = ['already-selected'];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have code text parameter', () => {
    expect(component.parameters).not.toBeNull();
    expect(component.parameters.length).toEqual(3);
    expect(component.parameters).toContain(
      jasmine.objectContaining({ element: 'code text' })
    );
  });

  it('should use composite controls for value-quantity search parameter', () => {
    expect(page.compositeTestValue).toBeNull();
    component.parameterName.setValue('value quantity');
    fixture.detectChanges(false);
    expect(page.compositeTestValue).not.toBeNull();
  });

  it('should not show already selected search parameters in the dropdown', () => {
    expect(component.parameterOptions.length).toEqual(2);
    expect(component.parameterOptions).toContain(
      jasmine.objectContaining({ name: 'Some name' })
    );
    expect(component.parameterOptions).not.toContain(
      jasmine.objectContaining({ name: 'already selected' })
    );
  });
});
