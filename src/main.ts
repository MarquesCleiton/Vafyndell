import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { LocationStrategy, HashLocationStrategy } from '@angular/common';
import { provideAnimations } from '@angular/platform-browser/animations';

import { App } from './app/app';
import { routes } from './app/app.routes';

bootstrapApplication(App, {
  providers: [
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',   // 👈 aqui troca "enabled" por "top"
        anchorScrolling: 'enabled',
      })
    ),
    provideAnimations(),
    { provide: LocationStrategy, useClass: HashLocationStrategy },
  ],
}).catch((err) => console.error(err));
