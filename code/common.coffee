window.id = (id)-> document.getElementById(id)
window.select = (selector)-> document.querySelectorAll(selector)
window.find_parent = (tagName, search)-> # find a parent element - useful with events
  if search.tagName.toLowerCase() == tagName
    search
  else if search is document.body
    null
  else if search.parentElement
    find_parent(tagName, search.parentElement)
