import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
    details?: any;
  }>({ status: 'idle' });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const buildMode = import.meta.env.MODE;

  const getHostname = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'Ungültig';
    }
  };

  const testConnection = async () => {
    setTestResult({ status: 'loading' });
    console.log('🔍 Testing Supabase connection...');

    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('id')
        .limit(1);

      if (error) {
        console.error('❌ Connection test failed:', error);
        setTestResult({
          status: 'error',
          message: error.message,
          details: error
        });
      } else {
        console.log('✅ Connection test successful:', data);
        setTestResult({
          status: 'success',
          message: 'Verbindung OK',
          details: { recordsFound: data?.length || 0 }
        });
      }
    } catch (err: any) {
      console.error('❌ Connection test exception:', err);
      setTestResult({
        status: 'error',
        message: err.message || 'Unbekannter Fehler',
        details: err
      });
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 transition flex items-center justify-between text-white text-sm font-medium"
        >
          <span>Diagnose</span>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {isOpen && (
          <div className="p-4 space-y-3 text-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Supabase URL geladen:</span>
                <span className="flex items-center gap-1">
                  {supabaseUrl ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-400">JA</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-400">NEIN</span>
                    </>
                  )}
                </span>
              </div>

              {supabaseUrl && (
                <div className="text-xs text-gray-400 pl-4">
                  Hostname: {getHostname(supabaseUrl)}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-300">Anon-Key geladen:</span>
                <span className="flex items-center gap-1">
                  {supabaseAnonKey ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-400">JA</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-400">NEIN</span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-300">Build Mode:</span>
                <span className="text-blue-400 font-mono">{buildMode}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-700">
              <button
                onClick={testConnection}
                disabled={testResult.status === 'loading'}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium flex items-center justify-center gap-2"
              >
                {testResult.status === 'loading' ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Teste...
                  </>
                ) : (
                  'Test Verbindung'
                )}
              </button>
            </div>

            {testResult.status !== 'idle' && testResult.status !== 'loading' && (
              <div
                className={`p-3 rounded-lg text-xs ${
                  testResult.status === 'success'
                    ? 'bg-green-900/50 border border-green-700'
                    : 'bg-red-900/50 border border-red-700'
                }`}
              >
                <div className="font-medium mb-2">
                  {testResult.status === 'success' ? (
                    <span className="text-green-400">✓ Verbindung OK</span>
                  ) : (
                    <span className="text-red-400">✗ Verbindung fehlgeschlagen</span>
                  )}
                </div>

                {testResult.details && (
                  <div className="space-y-1 text-gray-300">
                    {testResult.status === 'error' && (
                      <>
                        {testResult.details.code && (
                          <div>
                            <span className="text-gray-400">Code:</span> {testResult.details.code}
                          </div>
                        )}
                        {testResult.message && (
                          <div>
                            <span className="text-gray-400">Nachricht:</span> {testResult.message}
                          </div>
                        )}
                        {testResult.details.details && (
                          <div>
                            <span className="text-gray-400">Details:</span> {testResult.details.details}
                          </div>
                        )}
                        {testResult.details.hint && (
                          <div>
                            <span className="text-gray-400">Hinweis:</span> {testResult.details.hint}
                          </div>
                        )}
                      </>
                    )}
                    {testResult.status === 'success' && testResult.details.recordsFound !== undefined && (
                      <div>
                        <span className="text-gray-400">Datensätze gefunden:</span> {testResult.details.recordsFound}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
