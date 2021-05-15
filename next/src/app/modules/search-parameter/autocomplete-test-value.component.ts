import {
  AfterViewInit,
  Component,
  Input,
  OnChanges,
  OnInit
} from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import Def from 'autocomplete-lhc';

/**
 * data type used for this control
 */
export interface Lookup {
  code: string;
  display: string;
}

/**
 * Component for from/to date inputs combined together as one control
 */
@Component({
  selector: 'app-autocomplete-test-value',
  templateUrl: './autocomplete-test-value.component.html',
  styleUrls: ['./autocomplete-test-value.component.less'],
  providers: createControlValueAccessorProviders(AutoCompleteTestValueComponent)
})
export class AutoCompleteTestValueComponent
  extends BaseControlValueAccessor<Lookup[]>
  implements OnChanges, AfterViewInit {
  static idPrefix = 'autocomplete-test-value-';
  static idIndex = 0;
  inputId =
    AutoCompleteTestValueComponent.idPrefix +
    ++AutoCompleteTestValueComponent.idIndex;
  // Autocompleter instance
  acInstance: Def.Autocompleter.Prefetch;
  @Input() options: Lookup[];

  get value(): Lookup[] {
    return this.acInstance?.getSelectedCodes() || [];
  }

  ngOnChanges(): void {
    if (this.acInstance) {
      this.setupAutocomplete();
    }
  }

  ngAfterViewInit(): void {
    this.setupAutocomplete();
  }

  setupAutocomplete(): void {
    const testInputId = this.inputId;
    this.acInstance = new Def.Autocompleter.Prefetch(
      testInputId,
      this.options.map((o) => o.display),
      { maxSelect: '*', codes: this.options.map((o) => o.code) }
    );
    Def.Autocompleter.Event.observeListSelections(testInputId, () => {
      this.onChange(this.value);
    });
  }

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(): void {}
}
