'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => undefined);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => registration.update()).catch(() => undefined);
    }
  }, []);

  return null;
}
