import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EllipsisTextComponent } from './ellipsis-text.component';
import { EllipsisTextModule } from './ellipsis-text.module';
import { Component, ViewChild } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
  template: ` <div style="width: 100px">
    <app-ellipsis-text [text]="text"></app-ellipsis-text>
  </div>`
})
class TestHostComponent {
  @ViewChild(EllipsisTextComponent) component: EllipsisTextComponent;
  text = '';
}

describe('EllipsisTextComponent', () => {
  let hostComponent: TestHostComponent;
  let component: EllipsisTextComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let div: HTMLElement;
  let tooltip: MatTooltip;
  const LONG_TEXT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const SHORT_TEXT = 'aaa';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestHostComponent],
      imports: [EllipsisTextModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    hostComponent = fixture.componentInstance;
    component = hostComponent.component;
    spyOn(component, 'getTooltipText').and.callThrough();
    div = fixture.nativeElement.querySelector('app-ellipsis-text div');
    tooltip = fixture.debugElement
      .query(By.css('app-ellipsis-text div div'))
      .injector.get(MatTooltip);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set tooltip for long text', () => {
    hostComponent.text = LONG_TEXT;
    fixture.detectChanges();
    expect(component.getTooltipText).not.toHaveBeenCalled();
    expect(tooltip.message).toBe('');
    const event = new Event('mouseenter');
    div.dispatchEvent(event);
    expect(component.getTooltipText).toHaveBeenCalled();
    expect(tooltip.message).toBe(LONG_TEXT);
  });

  it('should not set tooltip for short text', () => {
    hostComponent.text = SHORT_TEXT;
    fixture.detectChanges();
    expect(component.getTooltipText).not.toHaveBeenCalled();
    expect(tooltip.message).toBe('');
    const event = new Event('mouseenter');
    div.dispatchEvent(event);
    expect(component.getTooltipText).toHaveBeenCalled();
    expect(tooltip.message).toBe('');
  });
});
