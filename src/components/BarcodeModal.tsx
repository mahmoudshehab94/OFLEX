import { useEffect } from 'react';
import { X } from 'lucide-react';

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText?: string;
  label?: string;
}

export function BarcodeModal({ isOpen, onClose, imageUrl, altText = 'Barcode', label }: BarcodeModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Barcode Vollbild-Ansicht"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all hover:scale-110"
        aria-label="Schließen"
      >
        <X className="w-6 h-6" />
      </button>

      <div
        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={altText}
          className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
        />
        {label && (
          <p className="mt-6 text-white text-lg font-medium text-center">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}
