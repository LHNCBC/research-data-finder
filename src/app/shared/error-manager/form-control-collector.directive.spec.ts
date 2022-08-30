import { FormControlCollectorDirective } from './form-control-collector.directive';
import {
  FormControl,
  FormControlDirective,
  FormControlName,
  NgModel
} from '@angular/forms';
import { ErrorManager } from './error-manager.service';

describe('FormControlCollectorDirective', () => {
  let formControl: FormControl;
  let formControlDirective: FormControlDirective;
  let formControlName: FormControlName;
  let ngModel: NgModel;
  let errorManager: ErrorManager;
  let directive: FormControlCollectorDirective;

  beforeAll(() => {
    formControl = new FormControl('');
    formControlDirective = {
      control: formControl
    } as FormControlDirective;
    formControlName = {
      control: formControl
    } as FormControlName;
    ngModel = {
      control: formControl
    } as NgModel;
    errorManager = new ErrorManager(null);
  });

  function tests(): void {
    it('should add FormControl to ErrorManager', () => {
      expect(errorManager.addControl).not.toHaveBeenCalled();
      directive.ngOnInit();
      expect(errorManager.addControl).toHaveBeenCalledOnceWith(formControl);
    });

    it('should remove FormControl from ErrorManager', () => {
      expect(errorManager.removeControl).not.toHaveBeenCalled();
      directive.ngOnDestroy();
      expect(errorManager.removeControl).toHaveBeenCalledOnceWith(formControl);
    });
  }

  describe('for [formControl]', () => {
    beforeAll(() => {
      spyOn(errorManager, 'addControl');
      spyOn(errorManager, 'removeControl');
      directive = new FormControlCollectorDirective(
        formControlDirective,
        null,
        null,
        errorManager
      );
    });

    tests();
  });

  describe('for [formControlName]', () => {
    beforeAll(() => {
      spyOn(errorManager, 'addControl');
      spyOn(errorManager, 'removeControl');
      directive = new FormControlCollectorDirective(
        null,
        formControlName,
        null,
        errorManager
      );
    });

    tests();
  });

  describe('for [ngModel]', () => {
    beforeAll(() => {
      spyOn(errorManager, 'addControl');
      spyOn(errorManager, 'removeControl');
      directive = new FormControlCollectorDirective(
        null,
        null,
        ngModel,
        errorManager
      );
    });

    tests();
  });
});
