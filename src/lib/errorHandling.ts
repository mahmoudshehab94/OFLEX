export function getSupabaseErrorMessage(error: any): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Konfigurationsfehler: SUPABASE Umgebungsvariablen fehlen (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).';
  }

  if (!error) {
    return 'Ein unbekannter Fehler ist aufgetreten.';
  }

  if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
    return 'Nicht autorisiert (RLS/Policy).';
  }

  if (error.code === '42501' || error.status === 401 || error.status === 403) {
    return 'Nicht autorisiert (RLS/Policy).';
  }

  if (error.message?.toLowerCase().includes('fetch') ||
      error.message?.toLowerCase().includes('network') ||
      error.name === 'TypeError' ||
      error.code === 'ECONNREFUSED') {
    return 'Netzwerkfehler: Verbindung zu Supabase fehlgeschlagen.';
  }

  if (error.message) {
    return error.message;
  }

  return 'Verbindungsfehler: Bitte versuchen Sie es erneut.';
}

export function logDetailedError(context: string, error: any) {
  console.error(`❌ ${context}:`, {
    message: error?.message,
    code: error?.code,
    status: error?.status,
    details: error?.details,
    hint: error?.hint,
    fullError: error
  });
}
