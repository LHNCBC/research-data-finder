import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectColumnsComponent } from './select-columns.component';
import { SelectColumnsModule } from './select-columns.module';

class Page {
  private fixture: ComponentFixture<SelectColumnsComponent>;
  constructor(fixture: ComponentFixture<SelectColumnsComponent>) {
    this.fixture = fixture;
  }
}

describe('SelectColumnsComponent', () => {
  let component: SelectColumnsComponent;
  let fixture: ComponentFixture<SelectColumnsComponent>;
  let page: Page;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SelectColumnsComponent],
      imports: [SelectColumnsModule]
    }).compileComponents();
    fixture = TestBed.createComponent(SelectColumnsComponent);
    page = new Page(fixture);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
