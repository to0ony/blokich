import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ActivatedRouteSnapshot, provideRouter, withViewTransitions } from '@angular/router';
import { isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app/app.routes';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

inject();
injectSpeedInsights();

/** Stranica (ruta) koja se prikazuje – za usporedbu prije i poslije navigacije. */
function stranica(s: ActivatedRouteSnapshot) {
  while (s.firstChild) s = s.firstChild;
  return s.routeConfig;
}

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    // Prijelaz između stranica kao u aplikaciji (View Transitions API; bez podrške – običan skok).
    // Promjena samo query parametara (tabovi vozača, odabir linije) ide bez animacije.
    provideRouter(
      routes,
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition, from, to }) => {
          if (stranica(from) === stranica(to)) transition.skipTransition();
        },
      }),
    ),
    // PrimeNG tema se postavlja tek na admin stranici (vidi DashboardAdminComponent),
    // da vozači ne skidaju PrimeNG u početnom bundleu.
    provideAnimationsAsync(),
    // Ljuska aplikacije u kešu i obavijest o novoj verziji (ngsw-config.json); samo u produkciji.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
});
