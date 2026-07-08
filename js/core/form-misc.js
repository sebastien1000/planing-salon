(function () {
  var data = window.SalonData;
  var formState = window.SalonFormState;
  var ui = window.SalonUI;

  function bindPhotoInput() {
    var state = formState.state;
    var photoInput = ui.byId("photoInput");
    var photoButton = ui.byId("photoButton");

    if (photoButton) {
      photoButton.addEventListener("click", function () {
        photoInput.click();
      });
    }

    photoInput.addEventListener("change", function (event) {
      var file = event.target.files[0];
      if (!file) {
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        state.db.photos.unshift(reader.result);
        state.db.photos = state.db.photos.slice(0, 3);

        try {
          data.saveDb(state.db);
          state.refresh();
        } catch (error) {
          window.alert("La photo est trop lourde pour le stockage local.");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  window.SalonMiscForms = {
    bindPhotoInput: bindPhotoInput
  };
}());
