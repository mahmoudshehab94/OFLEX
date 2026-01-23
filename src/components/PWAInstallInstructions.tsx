import { useState } from 'react';
import { Smartphone, Monitor, Apple, ChevronDown, ChevronUp } from 'lucide-react';

export function PWAInstallInstructions() {
  const [isOpen, setIsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useState(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  });

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="mt-6 bg-gray-700 rounded-lg border border-gray-600 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-white hover:bg-gray-600 transition"
      >
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-blue-400" />
          <span className="font-medium">App installieren</span>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 text-gray-200">
          <p className="text-sm text-gray-300 mt-2">
            Installieren Sie die App auf Ihrem Gerät für schnellen Zugriff und Offline-Nutzung.
          </p>

          {/* Android */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold text-white">Android</h3>
            </div>
            {deferredPrompt ? (
              <button
                onClick={handleInstallClick}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition font-medium"
              >
                Jetzt installieren
              </button>
            ) : (
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Tippen Sie auf das Menü (⋮) in Chrome/Edge</li>
                <li>Wählen Sie "Zum Startbildschirm hinzufügen"</li>
                <li>Bestätigen Sie die Installation</li>
              </ol>
            )}
          </div>

          {/* Windows */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-3">
              <Monitor className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">Windows</h3>
            </div>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Klicken Sie auf das Installationssymbol in der Adressleiste (Chrome/Edge)</li>
              <li>Oder: Menü (⋮) → "App installieren"</li>
              <li>Bestätigen Sie die Installation</li>
              <li>Die App erscheint im Startmenü</li>
            </ol>
          </div>

          {/* iPhone/iOS Safari */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-3">
              <Apple className="w-5 h-5 text-gray-300" />
              <h3 className="font-semibold text-white">iPhone (Safari)</h3>
            </div>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Tippen Sie auf das Teilen-Symbol <span className="inline-block bg-blue-500 text-white px-2 py-0.5 rounded text-xs">□↑</span> unten</li>
              <li>Scrollen Sie nach unten</li>
              <li>Tippen Sie auf "Zum Home-Bildschirm"</li>
              <li>Tippen Sie auf "Hinzufügen"</li>
            </ol>
            <div className="mt-3 p-3 bg-gray-900 rounded border border-gray-700">
              <p className="text-xs text-gray-400 mb-2">Visueller Guide:</p>
              <div className="flex gap-2 overflow-x-auto">
                <div className="flex-shrink-0 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-1">
                    <span className="text-2xl">□↑</span>
                  </div>
                  <p className="text-xs">1. Teilen</p>
                </div>
                <div className="flex-shrink-0 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mb-1">
                    <span className="text-2xl">⊕</span>
                  </div>
                  <p className="text-xs">2. Hinzufügen</p>
                </div>
                <div className="flex-shrink-0 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mb-1">
                    <span className="text-2xl">✓</span>
                  </div>
                  <p className="text-xs">3. Fertig</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
