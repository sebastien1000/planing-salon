(function () {
  function client() {
    var instance = window.SalonSupabaseClient;
    if (!instance) {
      throw new Error("Supabase n'est pas configure. Voir js/core/supabase-client.js.");
    }
    return instance;
  }

  function unwrap(promise) {
    return promise.then(function (result) {
      if (result.error) {
        throw result.error;
      }
      return result.data;
    });
  }

  var UNIQUE_VIOLATION = "23505";

  // ---- Profiles (droits + resolution nom/email -> id Supabase) ----

  function listProfiles() {
    return unwrap(client().from("profiles").select("*").order("name"));
  }

  function upsertProfile(profile) {
    return unwrap(client().from("profiles").upsert(profile).select().single());
  }

  // ---- Clientes ----

  function normalizePhone(phone) {
    return String(phone || "").replace(/\D/g, "");
  }

  function findClientMatch(clients, query) {
    var phone = normalizePhone(query.phone);
    var email = String(query.email || "").trim().toLowerCase();
    var name = String(query.name || "").trim().toLowerCase();

    if (phone) {
      var byPhone = clients.find(function (item) {
        return normalizePhone(item.phone) === phone;
      });
      if (byPhone) {
        return byPhone;
      }
    }

    if (email) {
      var byEmail = clients.find(function (item) {
        return String(item.email || "").trim().toLowerCase() === email;
      });
      if (byEmail) {
        return byEmail;
      }
    }

    if (name) {
      var byName = clients.find(function (item) {
        return String(item.name || "").trim().toLowerCase() === name;
      });
      if (byName) {
        return byName;
      }
    }

    return null;
  }

  function listClients() {
    return unwrap(client().from("clients").select("*").order("name"));
  }

  function insertClient(input) {
    return unwrap(
      client().from("clients").insert({
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        notes: input.notes || null,
        allergies: input.allergies || null,
        collab_id: input.collabId || null,
        prestation: input.prestation || null,
        duration: input.duration || null,
        frequency: input.frequency || null
      }).select().single()
    );
  }

  // Recherche par telephone, email ou nom ; reutilise la fiche existante,
  // sinon en cree une nouvelle. En cas de double-creation quasi simultanee
  // (rare), la contrainte unique sur le telephone cote base fait echouer le
  // deuxieme insert : on retrouve alors la fiche creee entre-temps.
  function findOrCreateClient(input) {
    return listClients().then(function (clients) {
      var existing = findClientMatch(clients, input);
      if (existing) {
        return existing;
      }

      return insertClient(input).catch(function (error) {
        if (error && error.code === UNIQUE_VIOLATION) {
          return listClients().then(function (freshClients) {
            var recovered = findClientMatch(freshClients, input);
            if (recovered) {
              return recovered;
            }
            throw error;
          });
        }

        throw error;
      });
    });
  }

  function updateClient(id, patch) {
    return unwrap(client().from("clients").update(patch).eq("id", id).select().single());
  }

  // ---- Rendez-vous ----
  // Lecture toujours via la vue reservations_public : elle renvoie deja les
  // vraies donnees pour le proprietaire/l'admin et les masque pour les
  // autres, cote serveur (voir supabase/schema.sql). L'app ne lit jamais la
  // table brute directement.

  function listReservationsForDates(dates) {
    return unwrap(
      client().from("reservations_public").select("*").in("date", dates)
    );
  }

  function listReservationsForClient(clientId) {
    return unwrap(
      client().from("reservations_public").select("*").eq("client_id", clientId).order("date")
    );
  }

  function createReservation(reservation) {
    return unwrap(client().from("reservations").insert(reservation).select().single());
  }

  function updateReservation(id, patch) {
    return unwrap(client().from("reservations").update(patch).eq("id", id).select().single());
  }

  window.SalonSupabaseData = {
    createReservation: createReservation,
    findOrCreateClient: findOrCreateClient,
    listClients: listClients,
    listProfiles: listProfiles,
    listReservationsForClient: listReservationsForClient,
    listReservationsForDates: listReservationsForDates,
    updateClient: updateClient,
    updateReservation: updateReservation,
    upsertProfile: upsertProfile
  };
}());
