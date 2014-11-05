gui = require 'nw.gui'
events = require 'events'
nw_window = gui.Window.get()

# update state info for subpage
state_update =->
  update = state: Array.prototype.slice.call(document.body.classList, 1)
  for iframe in select('.sub-page iframe')
    iframe.contentWindow?.postMessage?(update, iframe.contentWindow.location.origin)

# make platform available to css, for ui style matching
document.body.classList.add process.platform

for listen in ['keyup', 'keydown']
  document.addEventListener listen, (event)->
    document.body.classList.toggle 'option-key',  event.altKey
    document.body.classList.toggle 'shift-key',   event.shiftKey
    document.body.classList.toggle 'command-key', event.metaKey
    document.body.classList.toggle 'control-key', event.ctrlKey
    state_update()

nw_window.on 'enter-fullscreen', -> state_update(document.body.classList.add('fullscreen'))
nw_window.on 'leave-fullscreen', -> state_update(document.body.classList.remove('fullscreen'))

nw_window.on 'maximize',   -> state_update(document.body.classList.add('maximized'))
nw_window.on 'unmaximize', -> state_update(document.body.classList.remove('maximized'))

nw_window.on 'blur',  -> state_update(document.body.classList.add('unfocused'))
nw_window.on 'focus', -> state_update(document.body.classList.remove('unfocused'))

mac_toggle_fullscreen =->
  if document.body.classList.contains('option-key')
    unless document.body.classList.contains('maximized')
      nw_window.maximize()
    else
      nw_window.unmaximize()
  else if document.body.classList.contains('command-key')
    nw_window.showDevTools() # <-- semisecret way to open devtools
  else
    nw_window.toggleFullscreen()

btn.addEventListener('click', -> nw_window.minimize()) for btn in select('.system-ui button.minimize')
btn.addEventListener('click', -> nw_window.close()) for btn in select('.system-ui button.close')
btn.addEventListener('click', mac_toggle_fullscreen) for btn in select('.system-ui button.fullscreen')

#### navstrip functionality
class NavstripController extends events.EventEmitter
  constructor: (element)->
    @open_delay = 1.0
    @close_delay = 0#.5
    @strip = element
    @strip.addEventListener 'click', (event)=>
      button = find_parent('button', event.target)
      @set(button.id[4...]) if button
      clearTimeout(@hover_timer)
    # @strip.addEventListener 'mouseenter', (event)=>
    #   return if document.body.classList.contains('unfocused')
    #   clearTimeout(@hover_timer)
    #   @hover_timer = setTimeout(@open, @open_delay * 1000)
    @strip.addEventListener 'mousemove', (event)=>
      return if document.body.classList.contains('unfocused')
      clearTimeout(@hover_timer)
      @hover_timer = setTimeout(@open, @open_delay * 1000)
    @strip.addEventListener 'mouseleave', (event)=>
      clearTimeout(@hover_timer)
      @hover_timer = setTimeout(@close, @close_delay * 1000)

    process.nextTick =>
      @emit 'change', @get()

  set: (id)->
    return if id is @get()
    for button in @strip.children
      if button.id is "btn-#{id}"
        button.classList.add('selection')
        @emit 'change', id
      else
        button.classList.remove('selection')

  get: ->
    @strip.querySelector('.selection')?.id[4...]

  open: =>
    document.body.classList.add 'navstrip-open'
    @emit 'open'

  close: =>
    document.body.classList.remove 'navstrip-open'
    @emit 'close'

global.navstrip = new NavstripController(select('div.navstrip')[0])

# temporary static mockup navstrip simulation
global.navstrip.on 'change', (id)->
  if id is 'stream' or id is 'profile'
    select('.sub-page iframe')[0].src = "#{id}.html"


# menu is only visible on platforms like Mac OS where menu is not part of window
# TODO: detect ubuntu unity platform and enable there too
if process.platform is 'darwin'
  menubar = new gui.Menu(type: "menubar")

  stream_menu = new gui.Menu();
  stream_menu.append new gui.MenuItem(
    label: 'New Post', key: 'n', enabled: no
    click: -> alert 'Unimplemented'
  )
  stream_menu.append new gui.MenuItem(type: 'separator')
  stream_menu.append new gui.MenuItem(
    label: 'Profile', key: '1'
    click: -> global.navstrip.set('profile')
  )
  stream_menu.append new gui.MenuItem(
    label: 'Stream', key: '2'
    click: -> global.navstrip.set('stream')
  )
  stream_menu.append new gui.MenuItem(
    label: 'Events', key: '3'
    click: -> global.navstrip.set('events')
  )
  stream_menu.append new gui.MenuItem(
    label: 'Friends', key: '4',
    click: -> global.navstrip.set('friends')
  )
  stream_menu.append new gui.MenuItem(type: 'separator')
  stream_menu.append new gui.MenuItem(
    label: 'Go to User', key: 'u', enabled: no
    click: ->
      global.navstrip.set('friends')
      #friends_view.search_mode()
      alert("search mode not yet implemented")
  )

  developer_menu = new gui.Menu();
  developer_menu.append new gui.MenuItem(
    label: 'Reload Pane', key: 'r'
    click: -> select('iframe')[0].contentWindow.location.reload(true)
  )
  developer_menu.append new gui.MenuItem(
    label: 'Reload Navigator', key: 'r', modifiers: 'cmd-shift'
    click: -> window.location.reload(true)
  )
  developer_menu.append new gui.MenuItem(type: 'separator')
  developer_menu.append new gui.MenuItem(
    label: 'Inspect Pane', key: 'd'
    click: -> nw_window.showDevTools(select('iframe')[0])
  )
  developer_menu.append new gui.MenuItem(
    label: 'Reload Navigator', key: 'd', modifiers: 'cmd-shift'
    click: -> nw_window.showDevTools()
  )


  menubar.createMacBuiltin "Party"
  menubar.insert new gui.MenuItem(label: 'Stream', submenu: stream_menu), 1
  menubar.insert new gui.MenuItem(label: 'Developer', submenu: developer_menu), 2
  nw_window.menu = menubar
