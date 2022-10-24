import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './modules/home/home.component';
import { RasTokenCallbackComponent } from './modules/ras-token-callback/ras-token-callback.component';

const routes: Routes = [
  {
    path: 'request-redirect-token-callback',
    component: RasTokenCallbackComponent
  },
  { path: '**', component: HomeComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
