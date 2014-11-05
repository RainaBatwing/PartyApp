## Party

Early stages building a social network with elements of some server-based social web services, without any servers. Party is designed with a feminist ideology, and uses tumblr as a model to reduce social friction and increase creative expression. Unlike tumblr, Party encrypts your posts so only your friends or a subset of your choosing, can decrypt and view that post. Crypto inspired by @kaepora's [miniLock](https://minilock.io/), networking via [telehash](http://telehash.org) v2 (or maybe v3)


### What will it be like?

Your friend tells you about this neat Party App thing, and they give you an invite. You download the app either from your friend's computer or some website or whatever, and enter in the code. The code contains information for telehash to establish a direct UDP conversation with your friend's computer, over the local wifi, bluetooth, or internet. Your friend's computer pops up a window asking for friend confirmation, and if they accept your friend request, your computer uploads your profile in to your friend's PC, and vice versa, and then your computer starts downloading content from your friend's computer - their posts, encrypted settings blobs, encrypted chat logs, all sorts of stuff.

When you add new posts to the stream, your PC adds the encrypted object to it's local cache, and if it's managed to connect to any friends, it notifies them of new content. Those friends then attempt to download the new object, and once they have a copy, they announce it to other mutual friends, until everyone who is online at that moment has the new post.

Meanwhile, your computer maintains a connection to about five others, and every now and then purposefully drops a random connection and tries to connect to a different friend. Each time a new connection is established, the two parties calculate a list of objects that belong to mutual friends, and send a list of those object ids (hash of the original post) as well as a modification hash which is the original post data, plus any appended data. This goes back, maybe a month or two. The two parties compare lists, find any objects that have a different modification hash to their local cached copy, or objects they have never seen before, and add those object ids to their lists of things to sync. They then ask the friends they're connected to for more info about objects that conflict, and along those connections the party pairs exchange data until they both have objects that hash the same.

### But what does all that mean?

Pretty much tumblr, but you can say who can see your posts, and it's an app on your laptop, and when you go out to a park and sit in the sun, you can look at all the cat gifs and porn without needing a net connection, since it's already downloaded to your computer anyway. When your computer next has internet access, it'll sync. The other cool thing, is there are absolutely no servers involved! Nobody needs to make money. There are no bills to be paid. Party does not need a business model or venture capital or any of that stuff! So it can be free and wonderful forever!

Oh and it also means we can experiment a bunch, because of another technical aspect of Party:

Each stream post has a lump of very strictly controlled xhtml associated as the post content, and optionally resources like videos, short little audio clips, emoji graphics, touch screen pictochat-style doodles. So coders can make their own app, which publishes stream content in interesting new formats, with interesting new authoring interfaces. But that's not all:

A post can also include a secondary lump of html - the interactive blob. When a user activates an interactive stream item by clicking on it, it's content is replaced with an iframe, which loads the interactive blob. This can do stuff like connect to the internet to load youtube embeds, have little games, communal drawing pads, etc. Interactive posts will have a postMessage powered API allowing them to retrieve the post, as well as all appends, and also add new appends - that is, the widget can broadcast new metadata about the post in to the network for mesh-powered storage, and other widgets will be notified live about the new data as soon as it syncs! This will be used to implement, for instance, event pages, where the attending/maybe/not functionality will be javascript within the post itself, stored as timestamped appends. If a coder doesn't like the events UI, they can modify the app on their computer to do it differently, and then when they post events, it'll run their code on everyone elses computers, exposing their UI to their friends, who may feel so inspired that they'd want to switch to their friend's better version of Party!

Screw the cloud! WebApps in The Mesh is where the party should be going on!



### Cool enabling tech: ######
 * [miniLock](https://minilock.io/) (tweetnacl, curve25519), ed25519 (compact signing)
 * [node-webkit](https://github.com/rogerwang/node-webkit)
 * [telehash](http://telehash.org/)


Raina
