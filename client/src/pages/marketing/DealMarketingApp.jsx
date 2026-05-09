import { useEffect } from 'react';

// Navigate the full page to the Deal Marketing app.
// We can't iframe it — Chrome's Private Network Access policy blocks OAuth redirects
// from public pages (Firebase's auth handler) back to localhost/private network addresses.
export default function DealMarketingApp() {
  useEffect(() => {
    window.location.href = '/pacq-app';
  }, []);
  return null;
}
