import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { AppModule } from './app.module';
import { configureTestingModule } from '../test/helpers';

describe('AppComponent', () => {
  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [AppComponent],
        imports: [AppModule]
      },
      { skipInitApp: true }
    );
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
