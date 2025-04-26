import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { inject } from '@vercel/analytics';
import { authInterceptor } from './app/interceptors/auth.interceptor';

inject();

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
  ],
});
