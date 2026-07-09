(function () {
  // A remplir apres creation du projet sur https://supabase.com
  // Project Settings -> API -> Project URL / anon public key.
  // La cle "anon" n'est pas un secret : elle est concue pour etre publique.
  // Ne JAMAIS mettre ici la cle "service_role".
  var SUPABASE_URL = "https://hzrwswtsawytissojvtw.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_S_NnoON4N0Wfw6Kv8Cz8eg_qYxf_L8F";

  var isConfigured = SUPABASE_URL.indexOf("VOTRE-PROJET") === -1 &&
    SUPABASE_ANON_KEY.indexOf("VOTRE_CLE_ANON_PUBLIQUE") === -1;

  // Si le SDK Supabase (charge via la balise <script> CDN dans le HTML)
  // n'a pas pu se charger (reseau, bloqueur de script...), window.supabase
  // est absent : on l'indique clairement plutot que de planter en silence
  // et de laisser SalonSupabaseClient indefini.
  if (isConfigured && !window.supabase) {
    window.console && window.console.warn && window.console.warn(
      "Supabase : le SDK (script CDN) ne s'est pas charge, verifiez la balise <script> et la connexion reseau."
    );
    isConfigured = false;
  }

  window.SalonSupabaseClient = isConfigured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  window.SalonSupabaseConfigured = isConfigured;
}());
