import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { getConfigStatus, testDatabaseConnection } from '../lib/supabase';

export default function Diagnostics() {
  const [isOpen, setIsOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const config = getConfigStatus();

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await testDatabaseConnection();
      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Test failed: ${error.message}`,
        error
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
      >
        <Activity className="w-4 h-4" />
        <span className="text-sm font-medium">Diagnostics</span>
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-96 max-h-96 overflow-auto">
          <h3 className="font-semibold text-gray-900 mb-3">Configuration Status</h3>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">VITE_SUPABASE_URL:</span>
              <span className={config.hasUrl ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {config.hasUrl ? '✓ Set' : '✗ Missing'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">VITE_SUPABASE_ANON_KEY:</span>
              <span className={config.hasAnonKey ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {config.hasAnonKey ? '✓ Set' : '✗ Missing'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">VITE_ADMIN_PASSWORD:</span>
              <span className={config.hasAdminPassword ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {config.hasAdminPassword ? '✓ Set' : '✗ Missing'}
              </span>
            </div>

            {config.hasUrl && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                <div className="text-gray-500 mb-1">URL Hostname:</div>
                <div className="text-gray-900 font-mono break-all">{config.urlValue}</div>
              </div>
            )}
          </div>

          <button
            onClick={handleTestConnection}
            disabled={testing || !config.hasUrl || !config.hasAnonKey}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          {testResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className={`font-semibold mb-1 ${
                testResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {testResult.success ? '✓ Success' : '✗ Failed'}
              </div>
              <div className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                {testResult.message}
              </div>

              {testResult.error && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-red-600 font-medium">
                    Error Details
                  </summary>
                  <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(testResult.error, null, 2)}
                  </pre>
                </details>
              )}

              {testResult.details && (
                <div className="mt-2 text-xs opacity-75">
                  {JSON.stringify(testResult.details)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
