'use strict';
function toggleDiv(id, focusId) {
  let div = document.getElementById(id);
  div.style.display = div.style.display == "none" ? "inline" : "none";
  let toggle = document.getElementById('add-album');
  if (/closed/.test(toggle.className)) {
    toggle.classList.remove("closed");
    toggle.classList.add("open");
    document.getElementById(focusId).focus();
  }
  else {
    toggle.classList.remove("open");
    toggle.classList.add("closed");
  }
}

