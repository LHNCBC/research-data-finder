import { ErrorManager } from './error-manager.service';
import { UntypedFormControl, Validators } from '@angular/forms';
import {Component} from "@angular/core";
import {TestBed} from "@angular/core/testing";
import {By} from "@angular/platform-browser";

@Component({
  selector: 'parent-component',
  template: '<child-component></child-component>',
  providers: [ErrorManager]
})
class ParentComponent {
  constructor(public errorManager: ErrorManager) {
  }
}

@Component({
  selector: 'child-component',
  template: '',
  providers: [ErrorManager]
})
class ChildComponent {
  constructor(public errorManager: ErrorManager) {
  }
}

const validControl = new UntypedFormControl('');
const invalidControl = new UntypedFormControl('', Validators.required);

describe('ErrorManager', () => {
  let service: ErrorManager;

  beforeEach(() => {
    service = new ErrorManager(null);
  });

  it('should return errors', () => {
    service.addControl(validControl);
    expect(service.errors).toBeNull();
    service.addControl(invalidControl);
    expect(service.errors).toEqual({ required: true });
  });

  it('should hide errors by default', () => {
    service.addControl(validControl);
    service.addControl(invalidControl);
    expect(service.isErrorState(validControl, null)).toBe(false);
    expect(service.isErrorState(invalidControl, null)).toBe(false);
  });

  it('should show errors when needed', () => {
    service.addControl(validControl);
    service.addControl(invalidControl);
    service.showErrors();
    expect(service.isErrorState(validControl, null)).toBe(false);
    expect(service.isErrorState(invalidControl, null)).toBe(true);
  });
});

describe('ErrorManager DI hierarchy', () => {
  let parentService: ErrorManager;
  let childService: ErrorManager;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        ParentComponent,
        ChildComponent
      ]
    });
  });

  beforeEach(() => {
    const fixture = TestBed.createComponent(ParentComponent);
    parentService = fixture.componentInstance.errorManager;
    parentService.addControl(validControl);
    const childDebugElement = fixture.debugElement.query(By.directive(ChildComponent));
    childService = childDebugElement.componentInstance.errorManager;
    childService.addControl(invalidControl);
  });

  it('should return error if any of the child ErrorManagers has errors', () => {
    expect(parentService.errors).toEqual({ required: true });
    childService.removeControl(invalidControl);
    childService.addControl(validControl);
    expect(parentService.errors).toBeNull();
  });
});
