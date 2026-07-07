(function () {
  var formState = window.SalonFormState;
  var reservations = window.SalonReservationForms;
  var clients = window.SalonClientForms;
  var accounts = window.SalonAccountForms;
  var prestations = window.SalonPrestationForms;
  var misc = window.SalonMiscForms;

  window.SalonForms = {
    bindPhotoInput: misc.bindPhotoInput,
    bindPrestationActions: prestations.bindPrestationActions,
    bindReservationCardActions: reservations.bindReservationCardActions,
    cancelReservation: reservations.cancelReservation,
    configure: formState.configure,
    openAbsenceForm: misc.openAbsenceForm,
    openClientForm: clients.openClientForm,
    openPrestationForm: prestations.openPrestationForm,
    openProfileForm: accounts.openProfileForm,
    openReservation: reservations.openReservation,
    prestationCard: prestations.prestationCard,
    reservationCard: reservations.reservationCard,
    resetLink: accounts.resetLink,
    resetPassword: accounts.resetPassword,
    setReservationStatus: reservations.setReservationStatus
  };
}());
