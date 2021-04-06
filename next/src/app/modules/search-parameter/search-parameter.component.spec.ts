import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchParameterComponent } from './search-parameter.component';
import { SearchParametersModule } from '../search-parameters/search-parameters.module';

describe('SearchParameterComponent', () => {
  let component: SearchParameterComponent;
  let fixture: ComponentFixture<SearchParameterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SearchParameterComponent],
      imports: [SearchParametersModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SearchParameterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
