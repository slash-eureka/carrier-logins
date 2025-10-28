import 'dotenv/config';
import * as Sentry from '@sentry/node';

const sentryDsn = process.env.SENTRY_DSN;
const nodeEnv = process.env.NODE_ENV;

if (sentryDsn && nodeEnv == 'production') {
  Sentry.init({
    dsn: sentryDsn,
    environment: nodeEnv,
    tracesSampleRate: 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.onUncaughtExceptionIntegration({
        onFatalError: (err) => {
          console.error('[Sentry] Fatal error:', err);
        },
      }),
      Sentry.onUnhandledRejectionIntegration({
        mode: 'warn',
      }),
    ],
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['x-api-key'];
      }
      return event;
    },
  });
}
