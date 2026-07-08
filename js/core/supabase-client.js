(function () {
  // A remplir apres creation du projet sur https://supabase.com
  // Project Settings -> API -> Project URL / anon public key.
  // La cle "anon" n'est pas un secret : elle est concue pour etre publique.
  // Ne JAMAIS mettre ici la cle "service_role".
  var SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";
  var SUPABASE_ANON_KEY = "VOTRE_CLE_ANON_PUBLIQUE";

  var isConfigured = SUPABASE_URL.indexOf("VOTRE-PROJET") === -1 &&
    SUPABASE_ANON_KEY.indexOf("VOTRE_CLE_ANON_PUBLIQUE") === -1;

  window.SalonSupabaseClient = isConfigured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  window.SalonSupabaseConfigured = isConfigured;
}());
