import {Injectable} from '@angular/core';
import {
  HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpContextToken
} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError} from "rxjs/operators";
import {ToastrService} from "ngx-toastr";

// Token to store a flag to disable error display in the context of an HTTP request.
// See https://angular.io/api/common/http/HttpContext
export const HIDE_ERRORS = new HttpContextToken<boolean>(() => false);

@Injectable()
export class ToastrInterceptor implements HttpInterceptor {
  constructor(private toastr: ToastrService) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req)
      .pipe(
        catchError((err) => {
          if(!req.context.get(HIDE_ERRORS)) {
            this.toastr.error(err.error, 'HTTP error response', {
              timeOut: 10000,
              closeButton: true,
              tapToDismiss: false
            });
          }
          return throwError(err);
        })
      );
  }
}
