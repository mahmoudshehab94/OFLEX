import { useState, useEffect } from 'react';
import { testDatabaseConnection } from '../lib/supabase';
import { CheckCircle, XCircle, Loader, Database } from 'lucide-react';

export default function ConnectivityTest() {
  const [result, setResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'NOT_SET';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'NOT_SET';

  const extractHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  const runTest = async () => {
    setLoading(true);
    const testResult = await testDatabaseConnection();
    setResult(testResult);
    setLoading(false);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 max-w-md z-50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold">Health Check</span>
        </div>
        {loading ? (
          <Loader className="w-4 h-4 animate-spin text-gray-400" />
        ) : result?.success ? (
          <CheckCircle className="w-4 h-4 text-green-600" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Supabase URL</div>
              <div className="text-xs font-mono bg-white p-2 rounded border border-gray-200 truncate">
                {extractHostname(supabaseUrl)}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">API Key (last 6 chars)</div>
              <div className="text-xs font-mono bg-white p-2 rounded border border-gray-200">
                {supabaseKey !== 'NOT_SET' ? `...${supabaseKey.slice(-6)}` : 'NOT_SET'}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Testing connection...</span>
              </div>
            ) : result ? (
              <div>
                <div className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                  {result.success ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  <span className="font-medium">{result.message}</span>
                </div>

                {result.details && (
                  <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                    <pre className="whitespace-pre-wrap overflow-auto max-h-32">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </div>
                )}

                <button
                  onClick={runTest}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Test Again
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
