Party

An experiment, building a social network with elements of various server-based social web services, without any servers. Party is designed with a feminist ideology, and uses tumblr as a model to reduce social friction and increase creative expression. Unlike tumblr, Party uses encryption modeled off @kaepora's miniLock to provide a privacy model on posts, so only your intended audience can decrypt and display stream posts and attached metadata.

Some initial feature goals:

 - Stream, similar to tumblr dashboard, g+ stream, facebook feed
   > filtering by user lists, like google+ circles
   > no algorithmic filtering, unlike modern facebook
 - Several generic stream post classes:
   post:
     a piece of static content (limited html), which can include embedded images (gifs!), to be displayed like a microblog in stream
     cannot load resources from the public web - all media must be included with the post or part of the Party platform
   interactive:
     post + another piece of html content with scripts or other interactive elements - can be 'activated' to switch from post content to interactive document run in an iframe sandboxed
     this could be an youtube embed, animation, a little mini game, a communal doodle pad
   applet:
     as with interactive, but runs as a full page, used to represent things like events, photo albums, turn-based games
 - append only modifications to stream posts, with an api for interactive/applet mode to read, append, and display
 - hearts, like tumblr likes
 - replies (like comments) but only on posts which enable them (questions) - similar to tumblr
 - reblogging, like tumblr, as a primary method of commenting
 - metadata to make computer readable things like event name, start end times, for translation in to caldav feeds

Eventual feature goals:
 - customizable lists of friends, for easier post privacy and filtering
 - something akin to groups
 - private messenger, as another alternative to stream replies (which should mostly be disabled)
 - signed updates with viral worm-inspired distribution model - get updates from peers
 - more project contributors, eventually multisig on software updates

Cool enabling tech:
 - kaepora/miniLock (tweetnacl, curve25519), ed25519 (compact signing)
 - node-webkit
 - npm> telehash
 - npm> filterhtml

 ~~ Raina
