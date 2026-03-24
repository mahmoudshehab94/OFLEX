import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { OneSignalService } from './lib/onesignal';

function AppWithOneSignal() {
  useEffect(() => {
    const initOneSignal = async () => {
      try {
        await OneSignalService.initialize();
      } catch (error) {
        console.error('Failed to initialize OneSignal in main.tsx:', error);
      }
    };

    initOneSignal();
  }, []);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithOneSignal />
  </StrictMode>
);
