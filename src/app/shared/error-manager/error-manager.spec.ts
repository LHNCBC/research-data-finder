import { ErrorManager } from './error-manager.service';
import { FormControl, Validators } from '@angular/forms';

describe('ErrorManager', () => {
  let service: ErrorManager;
  const validControl = new FormControl('');
  const invalidControl = new FormControl('', Validators.required);

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
