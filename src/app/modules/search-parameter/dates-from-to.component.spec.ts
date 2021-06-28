import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedModule } from '../../shared/shared.module';
import { DatesFromToComponent } from './dates-from-to.component';
import { SearchParameterModule } from './search-parameter.module';

describe('DatesFromToComponent', () => {
  let component: DatesFromToComponent;
  let fixture: ComponentFixture<DatesFromToComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DatesFromToComponent],
      imports: [SearchParameterModule, SharedModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DatesFromToComponent);
    component = fixture.componentInstance;
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
});
