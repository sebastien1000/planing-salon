(function () {
  var formState = window.SalonFormState;
  var reservations = window.SalonReservationForms;
  var clients = window.SalonClientForms;
  var accounts = window.SalonAccountForms;
  var absences = window.SalonAbsenceForms;
  var holidays = window.SalonHolidayForms;
  var services = window.SalonServiceForms;

  window.SalonForms = {
    absenceCard: absences.absenceCard,
    bindAbsenceCardActions: absences.bindAbsenceCardActions,
    bindHolidayCardActions: holidays.bindHolidayCardActions,
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
    openProfileForm: accounts.openProfileForm,
    openReservation: reservations.openReservation,
    loadCollaboratorServiceEntries: services.loadCollaboratorEntries,
    openServicePickerSheet: services.openServicePickerSheet,
    renderServicesSection: services.renderServicesSection,
    saveAbsence: absences.saveAbsence,
    saveHoliday: holidays.saveHoliday,
    sendPasswordReset: accounts.sendPasswordReset,
    setReservationStatus: reservations.setReservationStatus,
    toggleAccountActive: accounts.toggleAccountActive
  };
}());
