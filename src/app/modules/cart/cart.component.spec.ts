import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CartComponent } from './cart.component';
import { configureTestingModule } from 'src/test/helpers';
import { Component, ViewChild } from '@angular/core';
import { CartModule } from './cart.module';
import Resource = fhir.Resource;

@Component({
  template: `<app-cart [resourceType]="resourceType" [listItems]="records">
  </app-cart>`,
  standalone: false
})
class TestHostComponent {
  @ViewChild(CartComponent)
  component: CartComponent;
  resourceType = 'ResearchStudy';
  records: Resource[] = [];
}

describe('CartComponent', () => {
  let component: CartComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [TestHostComponent],
      imports: [CartModule]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    hostComponent = fixture.componentInstance;
    component = hostComponent.component;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
