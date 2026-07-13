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
  var EXCLUSION_VIOLATION = "23P01"; // creneau/salle deja pris (contrainte EXCLUDE)

  // ---- Profiles (droits + resolution nom/email -> id Supabase) ----

  function listProfiles() {
    return unwrap(client().from("profiles").select("*").order("name"));
  }

  function upsertProfile(profile) {
    return unwrap(client().from("profiles").upsert(profile).select().single());
  }

  function resolveCollabId(profiles, name) {
    var match = profiles.find(function (item) { return item.name === name; });
    return match ? match.id : null;
  }

  function resolveCollabName(profiles, id) {
    var match = profiles.find(function (item) { return item.id === id; });
    return match ? match.name : "";
  }

  // ---- Prestations par collaboratrice (categories / services / tarifs) ----
  // Centralise ici tous les appels Supabase lies aux prestations, pour ne
  // pas eparpiller des ".from('services')..." dans les fichiers d'affichage
  // (js/core/form-services.js, js/core/form-reservations.js).

  function mapServiceCategoryRow(row) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon,
      displayOrder: row.display_order,
      active: row.active
    };
  }

  // includeInactive : necessaire pour l'ecran d'administration (pouvoir
  // reactiver une categorie desactivee) ; le menu de creation de rendez-vous
  // n'a lui besoin que des categories actives.
  function listServiceCategories(includeInactive) {
    var query = client().from("service_categories").select("*").order("display_order");
    if (!includeInactive) {
      query = query.eq("active", true);
    }
    return unwrap(query).then(function (rows) {
      return rows.map(mapServiceCategoryRow);
    });
  }

  function mapServiceRow(row) {
    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      active: row.active,
      displayOrder: row.display_order
    };
  }

  function listServices(includeInactive) {
    var query = client().from("services").select("*").order("display_order");
    if (!includeInactive) {
      query = query.eq("active", true);
    }
    return unwrap(query).then(function (rows) {
      return rows.map(mapServiceRow);
    });
  }

  // Admin uniquement (impose aussi cote base par la policy "services_write_admin").
  function upsertService(service) {
    var row = {
      category_id: service.categoryId,
      name: service.name,
      description: service.description || null,
      active: service.active !== false,
      display_order: service.displayOrder || 0
    };
    if (service.id) {
      row.id = service.id;
    }
    return unwrap(client().from("services").upsert(row).select().single()).then(mapServiceRow);
  }

  function mapCollaboratorServiceRow(row) {
    return {
      id: row.id,
      collaboratorId: row.collaborator_id,
      serviceId: row.service_id,
      price: row.price,
      duration: row.duration_minutes,
      active: row.active,
      customName: row.custom_name,
      notes: row.notes
    };
  }

  // Sans collaboratorId : l'admin recupere les prestations de tout le monde
  // (necessaire pour l'ecran d'administration). Avec collaboratorId : une
  // seule collaboratrice (ses propres prestations, ou celles choisies par
  // l'admin pour le menu de creation de rendez-vous).
  function listCollaboratorServices(collaboratorId) {
    var query = client().from("collaborator_services").select("*");
    if (collaboratorId) {
      query = query.eq("collaborator_id", collaboratorId);
    }
    return unwrap(query).then(function (rows) {
      return rows.map(mapCollaboratorServiceRow);
    });
  }

  function upsertCollaboratorService(entry) {
    var row = {
      collaborator_id: entry.collaboratorId,
      service_id: entry.serviceId,
      price: entry.price,
      duration_minutes: entry.duration,
      active: entry.active !== false,
      custom_name: entry.customName || null,
      notes: entry.notes || null
    };
    if (entry.id) {
      row.id = entry.id;
    }
    return unwrap(
      client().from("collaborator_services").upsert(row, { onConflict: "collaborator_id,service_id" }).select().single()
    ).then(mapCollaboratorServiceRow);
  }

  // Prestation deja utilisee dans des rendez-vous : on desactive plutot que
  // de supprimer (voir js/core/form-services.js), donc cette fonction ne
  // sert que pour une prestation jamais utilisee.
  function deleteCollaboratorService(id) {
    return unwrap(client().from("collaborator_services").delete().eq("id", id).select());
  }

  // Avant de proposer une suppression definitive, on verifie qu'aucun
  // rendez-vous (passe ou futur) ne pointe encore vers cette prestation
  // pour cette collaboratrice - sinon on desactive au lieu de supprimer
  // (voir js/core/form-services.js).
  function countReservationsForService(collabId, serviceId) {
    return unwrap(
      client().from("reservations_public").select("id").eq("collab_id", collabId).eq("service_id", serviceId)
    ).then(function (rows) {
      return rows.length;
    });
  }

  // ---- Clientes ----
  // Meme principe que pour les rendez-vous : la table stocke collab_id
  // (uuid), l'app manipule collabId ; le nom du collaborateur se resout au
  // besoin via resolveCollabName(state.profiles, client.collabId).

  function mapClientRow(row) {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      notes: row.notes,
      allergies: row.allergies,
      collabId: row.collab_id,
      prestation: row.prestation,
      duration: row.duration,
      frequency: row.frequency,
      nextDate: row.next_date
    };
  }

  function toClientRow(input) {
    var row = {};
    if (input.name !== undefined) row.name = input.name;
    if (input.phone !== undefined) row.phone = input.phone || null;
    if (input.email !== undefined) row.email = input.email || null;
    if (input.notes !== undefined) row.notes = input.notes || null;
    if (input.allergies !== undefined) row.allergies = input.allergies || null;
    if (input.collabId !== undefined) row.collab_id = input.collabId || null;
    if (input.prestation !== undefined) row.prestation = input.prestation || null;
    if (input.duration !== undefined) row.duration = input.duration || null;
    if (input.frequency !== undefined) row.frequency = input.frequency || null;
    if (input.nextDate !== undefined) row.next_date = input.nextDate || null;
    return row;
  }

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
    return unwrap(client().from("clients").select("*").order("name")).then(function (rows) {
      return rows.map(mapClientRow);
    });
  }

  function insertClient(input) {
    return unwrap(
      client().from("clients").insert(toClientRow(input)).select().single()
    ).then(mapClientRow);
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
    return unwrap(client().from("clients").update(toClientRow(patch)).eq("id", id).select().single())
      .then(mapClientRow);
  }

  // ---- Rendez-vous ----
  // Lecture toujours via la vue reservations_public : elle renvoie deja les
  // vraies donnees pour le proprietaire/l'admin et les masque pour les
  // autres, cote serveur (voir supabase/schema.sql). L'app ne lit jamais la
  // table brute directement. La forme renvoyee (client/collab/clientId...)
  // reprend volontairement les noms de champs deja utilises partout
  // ailleurs dans l'app, pour limiter les changements a faire autour.
  function mapReservationRow(row) {
    return {
      id: row.id,
      clientId: row.client_id,
      client: row.client_name,
      collab: row.collab_name,
      collabId: row.collab_id,
      room: row.room,
      prestation: row.prestation,
      serviceId: row.service_id,
      // Photo figee au moment du RDV : ne jamais recalculer depuis le
      // catalogue courant, sinon un changement de tarif changerait aussi
      // le prix des rendez-vous deja passes.
      price: row.price,
      date: row.date,
      time: String(row.time || "").slice(0, 5),
      duration: row.duration,
      status: row.status,
      notes: row.notes,
      supplement: row.supplement
    };
  }

  function toReservationRow(reservation) {
    return {
      client_id: reservation.clientId || null,
      client_name: reservation.client,
      collab_id: reservation.collabId,
      room: reservation.room,
      prestation: reservation.prestation,
      service_id: reservation.serviceId || null,
      price: reservation.price != null ? reservation.price : null,
      date: reservation.date,
      time: reservation.time,
      duration: reservation.duration,
      status: reservation.status,
      notes: reservation.notes || null,
      supplement: reservation.supplement || null
    };
  }

  function listReservationsForDates(dates) {
    return unwrap(
      client().from("reservations_public").select("*").in("date", dates)
    ).then(function (rows) {
      return rows.map(mapReservationRow);
    });
  }

  // Pas de bornage par date : la recherche doit pouvoir retrouver un
  // rendez-vous ancien ou a venir, comme le faisait la version localStorage.
  function listAllReservations() {
    return unwrap(
      client().from("reservations_public").select("*").order("date", { ascending: false })
    ).then(function (rows) {
      return rows.map(mapReservationRow);
    });
  }

  function listReservationsForClient(clientId) {
    return unwrap(
      client().from("reservations_public").select("*").eq("client_id", clientId).order("date")
    ).then(function (rows) {
      return rows.map(mapReservationRow);
    });
  }

  // error.isSlotTaken === true si l'erreur vient de la contrainte anti-
  // double-reservation (salle/creneau deja pris), verifiee par PostgreSQL
  // lui-meme et donc impossible a contourner cote navigateur.
  function markSlotTakenError(error) {
    if (error && error.code === EXCLUSION_VIOLATION) {
      error.isSlotTaken = true;
    }
    throw error;
  }

  function createReservation(reservation) {
    return unwrap(client().from("reservations").insert(toReservationRow(reservation)).select().single())
      .then(mapReservationRow)
      .catch(markSlotTakenError);
  }

  function updateReservation(id, reservation) {
    return unwrap(client().from("reservations").update(toReservationRow(reservation)).eq("id", id).select().single())
      .then(mapReservationRow)
      .catch(markSlotTakenError);
  }

  window.SalonSupabaseData = {
    countReservationsForService: countReservationsForService,
    createReservation: createReservation,
    deleteCollaboratorService: deleteCollaboratorService,
    findOrCreateClient: findOrCreateClient,
    listAllReservations: listAllReservations,
    listClients: listClients,
    listCollaboratorServices: listCollaboratorServices,
    listProfiles: listProfiles,
    listReservationsForClient: listReservationsForClient,
    listReservationsForDates: listReservationsForDates,
    listServiceCategories: listServiceCategories,
    listServices: listServices,
    resolveCollabId: resolveCollabId,
    resolveCollabName: resolveCollabName,
    updateClient: updateClient,
    updateReservation: updateReservation,
    upsertCollaboratorService: upsertCollaboratorService,
    upsertProfile: upsertProfile,
    upsertService: upsertService
  };
}());
