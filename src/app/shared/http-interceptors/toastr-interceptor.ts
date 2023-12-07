import {Injectable} from '@angular/core';
import {HttpEvent, HttpInterceptor, HttpHandler, HttpRequest} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError} from "rxjs/operators";
import {ToastrService} from "ngx-toastr";

@Injectable()
export class ToastrInterceptor implements HttpInterceptor {
  constructor(private toastr: ToastrService) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req)
      .pipe(
        catchError((err) => {
          this.toastr.error(err.error, 'HTTP error response', {
            timeOut: 10000,
            closeButton: true,
            tapToDismiss: false
          });
          return throwError(err);
        })
      );
  }
}
