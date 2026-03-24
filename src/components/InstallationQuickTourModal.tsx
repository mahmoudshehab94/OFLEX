import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Smartphone } from 'lucide-react';

interface InstallationQuickTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const slides = [
  {
    id: 'ios-1',
    title: 'iOS - Schritt 1',
    description: 'Öffnen Sie die App im Safari-Browser',
    icon: '📱'
  },
  {
    id: 'ios-2',
    title: 'iOS - Schritt 2',
    description: 'Tippen Sie auf das Teilen-Symbol unten in der Mitte',
    icon: '⬆️'
  },
  {
    id: 'ios-3',
    title: 'iOS - Schritt 3',
    description: 'Wählen Sie "Zum Home-Bildschirm" aus der Liste',
    icon: '➕'
  },
  {
    id: 'ios-4',
    title: 'iOS - Schritt 4',
    description: 'Bestätigen Sie mit "Hinzufügen" - fertig!',
    icon: '✅'
  },
  {
    id: 'android-1',
    title: 'Android - Schritt 1',
    description: 'Öffnen Sie die App im Chrome-Browser',
    icon: '📱'
  },
  {
    id: 'android-2',
    title: 'Android - Schritt 2',
    description: 'Tippen Sie auf das 3-Punkt-Menü (oben rechts)',
    icon: '⋮'
  },
  {
    id: 'android-3',
    title: 'Android - Schritt 3',
    description: 'Wählen Sie "App installieren" oder "Zum Startbildschirm hinzufügen"',
    icon: '➕'
  },
  {
    id: 'android-4',
    title: 'Android - Schritt 4',
    description: 'Bestätigen Sie die Installation - fertig!',
    icon: '✅'
  }
];

export function InstallationQuickTourModal({ isOpen, onClose }: InstallationQuickTourModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleClose = () => {
    setCurrentSlide(0);
    onClose();
  };

  if (!isOpen) return null;

  const slide = slides[currentSlide];
  const isIOS = currentSlide < 4;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-200"
        onClick={handleClose}
      />

      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 pointer-events-none">
        <div className="card w-full max-w-md max-h-[90vh] overflow-auto pointer-events-auto transform transition-all duration-300 ease-out">
          <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 p-6 flex items-center justify-between z-10">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              App installieren
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="text-6xl animate-pulse">{slide.icon}</div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {slide.title}
                  </h3>
                  <p className="text-gray-600 dark:text-slate-300 leading-relaxed">
                    {slide.description}
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-900 dark:text-blue-200">
                {isIOS ? (
                  <p className="font-medium">iOS: Schritt {currentSlide + 1} von 4</p>
                ) : (
                  <p className="font-medium">Android: Schritt {currentSlide - 3} von 4</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 flex-1 rounded-full transition-all duration-200 ${
                    idx === currentSlide
                      ? 'bg-blue-600 dark:bg-blue-500'
                      : 'bg-gray-300 dark:bg-slate-700 hover:bg-gray-400 dark:hover:bg-slate-600'
                  }`}
                  aria-label={`Gehe zu Schritt ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePrev}
                disabled={currentSlide === 0}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Zurück
              </button>
              {currentSlide < slides.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  Weiter
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="btn-primary flex-1"
                >
                  Fertig
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
