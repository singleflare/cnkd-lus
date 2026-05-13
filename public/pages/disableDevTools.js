document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener("keydown", function (e) {
  //document.onkeydown = function(e) {
  // "Ctrl+Shift+I" (DevTools)
  if (e.ctrlKey && e.shiftKey && e.keyCode == 73) {
    disabledEvent(e);
  }
  // "Ctrl+Shift+J" (DevTools)
  if (e.ctrlKey && e.shiftKey && e.keyCode == 74) {
    disabledEvent(e);
  }
  // "S" key + macOS  (DevTools)
  if (e.keyCode == 83 && (navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey)) {
    disabledEvent(e);
  }
  // "Ctrl+U" key (View source)
  if (e.ctrlKey && e.keyCode == 85) {
    disabledEvent(e);
  }
  // "F12" key (DevTools)
  if (e.keyCode == 123) {
    disabledEvent(e);
  }
}, false);
function disabledEvent(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  } else if (window.event) {
    window.event.cancelBubble = true;
  }
  e.preventDefault();
  return false;
}