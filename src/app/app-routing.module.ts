import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {HomeComponent} from './modules/home/home.component';
import {RasTokenCallbackComponent} from './modules/ras-token-callback/ras-token-callback.component';
import {LaunchComponent} from './modules/launch/launch.component';
import {Oauth2TokenCallbackComponent} from "./modules/oauth2-token-callback/oauth2-token-callback.component";

const routes: Routes = [
  {
    path: 'request-redirect-token-callback',
    component: RasTokenCallbackComponent
  },
  {
    path: 'oauth2-callback',
    component: Oauth2TokenCallbackComponent
  },
  {path: 'launch', component: LaunchComponent},
  {path: '**', component: HomeComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
