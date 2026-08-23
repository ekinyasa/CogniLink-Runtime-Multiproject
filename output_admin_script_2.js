
window.openNewIntentModal = function(e) {
  if (e) e.preventDefault();
  var modal = document.getElementById('modal-new-intent');
  if (modal) {
    modal.style.display = 'flex';
    console.log("Modal opened");
  } else {
    alert("Modal element not found in DOM!");
  }
};
          