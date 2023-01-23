import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatesFromToComponent } from './dates-from-to.component';
import { SearchParameterModule } from './search-parameter.module';
import { ErrorManager } from '../../shared/error-manager/error-manager.service';
import { configureTestingModule } from 'src/test/helpers';

describe('DatesFromToComponent', () => {
  let component: DatesFromToComponent;
  let fixture: ComponentFixture<DatesFromToComponent>;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [DatesFromToComponent],
      imports: [SearchParameterModule],
      providers: [ErrorManager]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DatesFromToComponent);
    component = fixture.componentInstance;
    DatesFromToComponent.defaultValue = { from: null, to: null };
    fixture.detectChanges();
  });

  it('should default date range values', () => {
    component.writeValue({
      from: '01-02-2019',
      to: '06-28-2021'
    });
    const component2 = new DatesFromToComponent();
    component2.ngAfterViewInit();
    expect(component2.value).not.toBeNull();
    expect(component2.value.from).toEqual('01-02-2019');
    expect(component2.value.to).toEqual('06-28-2021');
  });

  it('should default from date value', () => {
    component.writeValue({
      from: '01-02-2021',
      to: null
    });
    const component2 = new DatesFromToComponent();
    component2.ngAfterViewInit();
    expect(component2.value).not.toBeNull();
    expect(component2.value.from).toEqual('01-02-2021');
    expect(component2.value.to).toBeNull();
  });
});
