import { FormControlCollectorDirective } from './form-control-collector.directive';
import { FormControl, FormControlDirective } from '@angular/forms';
import { ErrorManager } from './error-manager.service';

describe('FormControlCollectorDirective', () => {
  let formControl: FormControl;
  let formControlDirective: FormControlDirective;
  let errorManager: ErrorManager;
  let directive: FormControlCollectorDirective;

  beforeAll(() => {
    formControl = new FormControl('');
    formControlDirective = {
      control: formControl
    } as FormControlDirective;
    errorManager = new ErrorManager();
    spyOn(errorManager, 'addControl');
    spyOn(errorManager, 'removeControl');
    directive = new FormControlCollectorDirective(
      formControlDirective,
      errorManager
    );
  });

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
});
