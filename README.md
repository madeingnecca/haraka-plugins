Haraka Plugins
==============

Haraka is a smtp server written in Node. I found it very useful for testing purposes. Here is a small collection of plugins I wrote to make life easier when testing email stuff.

### maildir.js
Implements a rudimental maildir backend for your smtp server, readable by other mail servers, like Dovecot.
The third party server can be used to serve emails to clients using pop or imap. Requires <strong>mkdirp</strong>.

### showbcc.js
Adds a custom header ("X-bcc") containing recipients in blind carbon copy. Useful when you have apps sending emails with hidden recipients and you want to test that everything is working fine.
Requires <strong>underscore</strong>.

### relay_fake.js
Accepts messages for delivery even if your server is not configured to send to a relay server. Useful when messages must not be sent but positive responses must be given to smtp clients.
