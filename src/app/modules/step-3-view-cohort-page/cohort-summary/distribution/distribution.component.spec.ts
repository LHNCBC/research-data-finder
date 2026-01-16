import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DistributionComponent, DistributionItem } from './distribution.component';

describe('DistributionComponent', () => {
  let component: DistributionComponent;
  let fixture: ComponentFixture<DistributionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DistributionComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DistributionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Input Properties', () => {
    it('should accept title input', () => {
      component.title = 'Test Distribution';
      fixture.detectChanges();

      const titleElement = fixture.nativeElement.querySelector('h3');
      expect(titleElement.textContent).toBe('Test Distribution');
    });

    it('should accept items input', () => {
      const items: DistributionItem[] = [
        { key: 'Category A', value: 10, percentage: 50 },
        { key: 'Category B', value: 10, percentage: 50 }
      ];

      component.items = items;
      fixture.detectChanges();

      const itemElements = fixture.nativeElement.querySelectorAll('.item');
      expect(itemElements.length).toBe(2);
    });

    it('should handle empty items array', () => {
      component.items = [];
      fixture.detectChanges();

      const itemElements = fixture.nativeElement.querySelectorAll('.item');
      expect(itemElements.length).toBe(0);
    });
  });


  describe('Bar Rendering', () => {
    it('should render bars with correct widths', () => {
      const items: DistributionItem[] = [
        { key: 'A', value: 50, percentage: 50 },
        { key: 'B', value: 30, percentage: 30 },
        { key: 'C', value: 20, percentage: 20 }
      ];

      component.items = items;
      fixture.detectChanges();

      const bars = fixture.nativeElement.querySelectorAll('.bar');
      expect(bars[0].style.width).toBe('50%');
      expect(bars[1].style.width).toBe('30%');
      expect(bars[2].style.width).toBe('20%');
    });

    it('should display percentage labels', () => {
      const items: DistributionItem[] = [
        { key: 'A', value: 75, percentage: 75 }
      ];

      component.items = items;
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('.bar-label');
      expect(label.textContent).toBe('75%');
    });

    it('should display count with correct singular/plural', () => {
      const items: DistributionItem[] = [
        { key: 'Single', value: 1, percentage: 50 },
        { key: 'Multiple', value: 5, percentage: 50 }
      ];

      component.items = items;
      fixture.detectChanges();

      const counts = fixture.nativeElement.querySelectorAll('.count');
      expect(counts[0].textContent).toContain('1 patient');
      expect(counts[1].textContent).toContain('5 patients');
    });
  });


  describe('Bar Label Adjustment', () => {
    it('should add small-bar class when label does not fit', () => {
      const items: DistributionItem[] = [
        { key: 'A', value: 1, percentage: 5 } // Very small bar
      ];

      component.items = items;
      fixture.detectChanges();

      // Mock the DOM measurements
      const bar = fixture.nativeElement.querySelector('.bar') as HTMLElement;
      const label = bar.querySelector('.bar-label') as HTMLElement;

      // Simulate narrow bar
      spyOnProperty(bar, 'offsetWidth', 'get').and.returnValue(20);
      spyOnProperty(label, 'offsetWidth', 'get').and.returnValue(50);

      component.adjustBarLabels();

      expect(bar.classList.contains('small-bar')).toBe(true);
    });

    it('should remove small-bar class when label fits', () => {
      const items: DistributionItem[] = [
        { key: 'A', value: 90, percentage: 90 } // Large bar
      ];

      component.items = items;
      fixture.detectChanges();

      const bar = fixture.nativeElement.querySelector('.bar') as HTMLElement;
      const label = bar.querySelector('.bar-label') as HTMLElement;

      // Simulate wide bar
      spyOnProperty(bar, 'offsetWidth', 'get').and.returnValue(200);
      spyOnProperty(label, 'offsetWidth', 'get').and.returnValue(50);

      bar.classList.add('small-bar'); // Start with class
      component.adjustBarLabels();

      expect(bar.classList.contains('small-bar')).toBe(false);
    });

    it('should call adjustBarLabels on window resize', () => {
      spyOn(component, 'adjustBarLabels');

      window.dispatchEvent(new Event('resize'));

      expect(component.adjustBarLabels).toHaveBeenCalled();
    });

    it('should call adjustBarLabels after view init', () => {
      spyOn(component, 'adjustBarLabels');

      component.ngAfterViewInit();

      expect(component.adjustBarLabels).toHaveBeenCalled();
    });
  });
});
