// Generated by CoffeeScript 1.8.0
var NavstripController, btn, developer_menu, events, gui, listen, mac_toggle_fullscreen, menubar, nw_window, state_update, stream_menu, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref, _ref1, _ref2, _ref3,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

gui = require('nw.gui');

events = require('events');

nw_window = gui.Window.get();

state_update = function() {
  var iframe, update, _i, _len, _ref, _ref1, _results;
  update = {
    state: Array.prototype.slice.call(document.body.classList, 1)
  };
  _ref = select('.sub-page iframe');
  _results = [];
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    iframe = _ref[_i];
    _results.push((_ref1 = iframe.contentWindow) != null ? typeof _ref1.postMessage === "function" ? _ref1.postMessage(update, iframe.contentWindow.location.origin) : void 0 : void 0);
  }
  return _results;
};

document.body.classList.add(process.platform);

_ref = ['keyup', 'keydown'];
for (_i = 0, _len = _ref.length; _i < _len; _i++) {
  listen = _ref[_i];
  document.addEventListener(listen, function(event) {
    document.body.classList.toggle('option-key', event.altKey);
    document.body.classList.toggle('shift-key', event.shiftKey);
    document.body.classList.toggle('command-key', event.metaKey);
    document.body.classList.toggle('control-key', event.ctrlKey);
    return state_update();
  });
}

nw_window.on('enter-fullscreen', function() {
  return state_update(document.body.classList.add('fullscreen'));
});

nw_window.on('leave-fullscreen', function() {
  return state_update(document.body.classList.remove('fullscreen'));
});

nw_window.on('maximize', function() {
  return state_update(document.body.classList.add('maximized'));
});

nw_window.on('unmaximize', function() {
  return state_update(document.body.classList.remove('maximized'));
});

nw_window.on('blur', function() {
  return state_update(document.body.classList.add('unfocused'));
});

nw_window.on('focus', function() {
  return state_update(document.body.classList.remove('unfocused'));
});

mac_toggle_fullscreen = function() {
  if (document.body.classList.contains('option-key')) {
    if (!document.body.classList.contains('maximized')) {
      return nw_window.maximize();
    } else {
      return nw_window.unmaximize();
    }
  } else if (document.body.classList.contains('command-key')) {
    return nw_window.showDevTools();
  } else {
    return nw_window.toggleFullscreen();
  }
};

_ref1 = select('.system-ui button.minimize');
for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
  btn = _ref1[_j];
  btn.addEventListener('click', function() {
    return nw_window.minimize();
  });
}

_ref2 = select('.system-ui button.close');
for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
  btn = _ref2[_k];
  btn.addEventListener('click', function() {
    return nw_window.close();
  });
}

_ref3 = select('.system-ui button.fullscreen');
for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
  btn = _ref3[_l];
  btn.addEventListener('click', mac_toggle_fullscreen);
}

NavstripController = (function(_super) {
  __extends(NavstripController, _super);

  function NavstripController(element) {
    this.close = __bind(this.close, this);
    this.open = __bind(this.open, this);
    this.open_delay = 1.0;
    this.close_delay = 0;
    this.strip = element;
    this.strip.addEventListener('click', (function(_this) {
      return function(event) {
        var button;
        button = find_parent('button', event.target);
        if (button) {
          _this.set(button.id.slice(4));
        }
        return clearTimeout(_this.hover_timer);
      };
    })(this));
    this.strip.addEventListener('mousemove', (function(_this) {
      return function(event) {
        if (document.body.classList.contains('unfocused')) {
          return;
        }
        clearTimeout(_this.hover_timer);
        return _this.hover_timer = setTimeout(_this.open, _this.open_delay * 1000);
      };
    })(this));
    this.strip.addEventListener('mouseleave', (function(_this) {
      return function(event) {
        clearTimeout(_this.hover_timer);
        return _this.hover_timer = setTimeout(_this.close, _this.close_delay * 1000);
      };
    })(this));
    process.nextTick((function(_this) {
      return function() {
        return _this.emit('change', _this.get());
      };
    })(this));
  }

  NavstripController.prototype.set = function(id) {
    var button, _len4, _m, _ref4, _results;
    if (id === this.get()) {
      return;
    }
    _ref4 = this.strip.children;
    _results = [];
    for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
      button = _ref4[_m];
      if (button.id === ("btn-" + id)) {
        button.classList.add('selection');
        _results.push(this.emit('change', id));
      } else {
        _results.push(button.classList.remove('selection'));
      }
    }
    return _results;
  };

  NavstripController.prototype.get = function() {
    var _ref4;
    return (_ref4 = this.strip.querySelector('.selection')) != null ? _ref4.id.slice(4) : void 0;
  };

  NavstripController.prototype.open = function() {
    document.body.classList.add('navstrip-open');
    return this.emit('open');
  };

  NavstripController.prototype.close = function() {
    document.body.classList.remove('navstrip-open');
    return this.emit('close');
  };

  return NavstripController;

})(events.EventEmitter);

global.navstrip = new NavstripController(select('div.navstrip')[0]);

global.navstrip.on('change', function(id) {
  if (id === 'stream' || id === 'profile') {
    return select('.sub-page iframe')[0].src = "" + id + ".html";
  }
});

if (process.platform === 'darwin') {
  menubar = new gui.Menu({
    type: "menubar"
  });
  stream_menu = new gui.Menu();
  stream_menu.append(new gui.MenuItem({
    label: 'New Post',
    key: 'n',
    enabled: false,
    click: function() {
      return alert('Unimplemented');
    }
  }));
  stream_menu.append(new gui.MenuItem({
    type: 'separator'
  }));
  stream_menu.append(new gui.MenuItem({
    label: 'Profile',
    key: '1',
    click: function() {
      return global.navstrip.set('profile');
    }
  }));
  stream_menu.append(new gui.MenuItem({
    label: 'Stream',
    key: '2',
    click: function() {
      return global.navstrip.set('stream');
    }
  }));
  stream_menu.append(new gui.MenuItem({
    label: 'Events',
    key: '3',
    click: function() {
      return global.navstrip.set('events');
    }
  }));
  stream_menu.append(new gui.MenuItem({
    label: 'Friends',
    key: '4',
    click: function() {
      return global.navstrip.set('friends');
    }
  }));
  stream_menu.append(new gui.MenuItem({
    type: 'separator'
  }));
  stream_menu.append(new gui.MenuItem({
    label: 'Go to User',
    key: 'u',
    enabled: false,
    click: function() {
      global.navstrip.set('friends');
      return alert("search mode not yet implemented");
    }
  }));
  developer_menu = new gui.Menu();
  developer_menu.append(new gui.MenuItem({
    label: 'Reload Pane',
    key: 'r',
    click: function() {
      return select('iframe')[0].contentWindow.location.reload(true);
    }
  }));
  developer_menu.append(new gui.MenuItem({
    label: 'Reload Navigator',
    key: 'r',
    modifiers: 'cmd-shift',
    click: function() {
      return window.location.reload(true);
    }
  }));
  developer_menu.append(new gui.MenuItem({
    type: 'separator'
  }));
  developer_menu.append(new gui.MenuItem({
    label: 'Inspect Pane',
    key: 'd',
    click: function() {
      return nw_window.showDevTools(select('iframe')[0]);
    }
  }));
  developer_menu.append(new gui.MenuItem({
    label: 'Reload Navigator',
    key: 'd',
    modifiers: 'cmd-shift',
    click: function() {
      return nw_window.showDevTools();
    }
  }));
  menubar.createMacBuiltin("Party");
  menubar.insert(new gui.MenuItem({
    label: 'Stream',
    submenu: stream_menu
  }), 1);
  menubar.insert(new gui.MenuItem({
    label: 'Developer',
    submenu: developer_menu
  }), 2);
  nw_window.menu = menubar;
}

//# sourceMappingURL=navigator.js.map
