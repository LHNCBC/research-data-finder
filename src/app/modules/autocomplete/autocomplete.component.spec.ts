import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutocompleteComponent } from './autocomplete.component';
import { AutocompleteModule } from './autocomplete.module';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('AutocompleteComponent', () => {
  let component: AutocompleteComponent;
  let fixture: ComponentFixture<AutocompleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutocompleteModule, NoopAnimationsModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AutocompleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should left match word boundaries when filtering search parameters', async () => {
    let currentOptions;
    component.filteredOptions$.subscribe(
      (options) => (currentOptions = options)
    );
    component.options = ['Some name', 'value quantity'];
    component.focus();

    component.control.setValue('an');
    expect(currentOptions.length).toBe(0);

    component.control.setValue('qu');
    expect(currentOptions.length).toBe(1);

    component.control.setValue('ty');
    expect(currentOptions.length).toBe(0);
  });
});
