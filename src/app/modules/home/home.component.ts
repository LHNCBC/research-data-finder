import { AfterViewInit, Component, OnInit } from '@angular/core';
import pkg from '../../../../package.json';
import { getUrlParam, setUrlParam } from '../../shared/utils';
import { FhirService } from '../../shared/fhir-service/fhir.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.less']
})
export class HomeComponent implements AfterViewInit, OnInit {
  version = pkg.version;
  isAlpha: boolean;

  constructor(private fhirService: FhirService) {
    this.isAlpha = getUrlParam('alpha-version') === 'enable';
  }

  ngOnInit(): void {
    if (
      !this.fhirService.getSmartConnection() &&
      !this.fhirService.smartConnectionInProgress()
    ) {
      this.fhirService.requestSmartConnection((success) => {
        if (success) {
          const smart = this.fhirService.getSmartConnection();
          const userPromise = smart.user.read().then((user) => {
            this.fhirService.setCurrentUser(user);
          });
          Promise.all([userPromise]).then(
            () => {},
            (msg) => {
              console.log('Unable to read the patient and user resources.');
              console.log(msg);
            }
          );
        } else {
          console.log('Could not establish a SMART connection.');
        }
      });
    }
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
