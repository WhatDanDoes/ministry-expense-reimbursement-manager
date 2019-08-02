'use strict';

/**
 * 2016-11-19
 * Adapted from:
 * https://www.raymondcamden.com/2013/09/10/Adding-a-file-display-list-to-a-multifile-upload-HTML-control
 */
var selDiv = '',
    button = '';

document.addEventListener('DOMContentLoaded', init, false);

function init() {
  var docs = document.querySelector('#docs');
  if (docs) {
    docs.addEventListener('change', handleFileSelect, false);
  }
  selDiv = document.querySelector('#selected-files');
  button = document.querySelector('#file-upload-button');
}

function handleFileSelect(e) {

  if(!e.target.files || !window.FileReader) return;

  selDiv.innerHTML = "";

  var files = e.target.files;
  var filesArr = Array.prototype.slice.call(files);

  // Show/hide file submit button
  button.style.display = 'none';
  if (filesArr.length) {
    button.style.display = 'block';
  }

  // Render files to screen
  filesArr.forEach(function(f) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var html = '<li>' + f.name + '</li>';
      selDiv.innerHTML += html;               
    }
    reader.readAsDataURL(f); 
  });
}
