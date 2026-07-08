(function () {
  var formState = window.SalonFormState;
  var reservations = window.SalonReservationForms;
  var clients = window.SalonClientForms;
  var accounts = window.SalonAccountForms;
  var prestations = window.SalonPrestationForms;
  var misc = window.SalonMiscForms;
  var absences = window.SalonAbsenceForms;
  var holidays = window.SalonHolidayForms;

  window.SalonForms = {
    absenceCard: absences.absenceCard,
    bindAbsenceCardActions: absences.bindAbsenceCardActions,
    bindHolidayCardActions: holidays.bindHolidayCardActions,
    bindPhotoInput: misc.bindPhotoInput,
    bindPrestationActions: prestations.bindPrestationActions,
    bindReservationCardActions: reservations.bindReservationCardActions,
    cancelReservation: reservations.cancelReservation,
    canManageAbsence: absences.canManageAbsence,
    configure: formState.configure,
    deleteAbsence: absences.deleteAbsence,
    deleteAccount: accounts.deleteAccount,
    deleteHoliday: holidays.deleteHoliday,
    holidayCard: holidays.holidayCard,
    holidaysForCollab: holidays.holidaysForCollab,
    openAbsenceForm: absences.openAbsenceForm,
    openAddAccountForm: accounts.openAddAccountForm,
    openClientForm: clients.openClientForm,
    openHolidayForm: holidays.openHolidayForm,
    openPrestationForm: prestations.openPrestationForm,
    openProfileForm: accounts.openProfileForm,
    openReservation: reservations.openReservation,
    prestationCard: prestations.prestationCard,
    reservationCard: reservations.reservationCard,
    resetLink: accounts.resetLink,
    resetPassword: accounts.resetPassword,
    saveAbsence: absences.saveAbsence,
    saveHoliday: holidays.saveHoliday,
    setReservationStatus: reservations.setReservationStatus,
    toggleAccountActive: accounts.toggleAccountActive
  };
}());
