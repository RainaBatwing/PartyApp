// Generated by CoffeeScript 1.8.0
var FreezeGIF, gui, initial_class_name, safe_protocols;

gui = require('nw.gui');

initial_class_name = document.body.className;

window.addEventListener('message', function(message) {
  if (message.state) {
    return document.body.className = "" + initial_class_name + " " + (message.state.join(' '));
  }
});

safe_protocols = ['https:', 'http:', 'thtp:', 'bitcoin:', 'dogecoin:', 'xmpp:', 'jabber:', 'mailto:', 'magnet:', 'steam:'];

document.body.addEventListener('click', function(event) {
  var link;
  if (link = find_parent('a', event.target)) {
    event.preventDefault();
    event.stopPropegation();
    if (link.protocol === 'https:' || link.protocol === 'http:') {
      return gui.Shell.openExternal(link.href);
    } else {
      return alert("Link blocked, tried to open unusual protocol " + link.protocol);
    }
  }
});

FreezeGIF = (function() {
  function FreezeGIF(gif) {
    this.gif = gif;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.gif.width;
    this.canvas.height = this.gif.height;
    this.canvas.getContext('2d').drawImage(this.gif, 0, 0);
  }

  FreezeGIF.prototype.freeze = function() {
    if (this.gif.parentElement) {
      return this.gif.parentElement.replaceChild(this.canvas, this.gif);
    }
  };

  FreezeGIF.prototype.play = function() {
    if (this.canvas.parentElement) {
      return this.canvas.parentElement.replaceChild(this.gif, this.canvas);
    }
  };

  return FreezeGIF;

})();

//# sourceMappingURL=stream.js.map
