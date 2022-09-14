import { AfterViewInit, Component } from '@angular/core';
import pkg from '../../package.json';
import { getUrlParam, setUrlParam } from './shared/utils';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements AfterViewInit {
  version = pkg.version;
  isAlpha: boolean;

  constructor() {
    this.isAlpha = getUrlParam('alpha-version') === 'enable';
  }

  openChangelog(): void {
    window.open(
      'https://github.com/lhncbc/fhir-obs-viewer/blob/master/CHANGELOG.md',
      '_blank',
      'noopener noreferrer'
    );
  }
  switchVersion(): void {
    window.location.href = setUrlParam(
      'alpha-version',
      this.isAlpha ? 'disable' : 'enable'
    );
  }

  ngAfterViewInit(): void {
    // Display shared header/footer after Angular page loads.
    document.getElementById('sharedHeader').style.display = 'block';
    document.getElementById('sharedFooter').style.display = 'block';
  }
}
