gui = require('nw.gui')
initial_class_name = document.body.className

window.addEventListener 'message', (message)->
  if message.state
    document.body.className = "#{initial_class_name} #{message.state.join(' ')}"

# whitelist of external uri protocols
safe_protocols = [
  'https:', 'http:', 'thtp:'
  'bitcoin:', 'dogecoin:',
  'xmpp:', 'jabber:', 'mailto:',
  'magnet:', 'steam:',
]
document.body.addEventListener 'click', (event)->
  if link = find_parent('a', event.target)
    event.preventDefault()
    event.stopPropegation()
    if link.protocol is 'https:' or link.protocol is 'http:'
      gui.Shell.openExternal(link.href);
    else
      alert("Link blocked, tried to open unusual protocol #{link.protocol}")



# snapshot a frame from a gif, to allow pausing when blurred or out of view
class FreezeGIF
  constructor: (gif)->
    @gif = gif

    @canvas = document.createElement('canvas')
    @canvas.width = @gif.width
    @canvas.height = @gif.height
    @canvas.getContext('2d').drawImage(@gif, 0, 0)

  freeze: ->
    @gif.parentElement.replaceChild(@canvas, @gif) if @gif.parentElement

  play: ->
    @canvas.parentElement.replaceChild(@gif, @canvas) if @canvas.parentElement
