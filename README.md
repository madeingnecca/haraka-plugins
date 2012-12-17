Haraka Plugins
==============

Haraka is a smtp server written in Node. I found it very useful for testing purposes. Here is a small collection of plugins I wrote to make life easier when testing email stuff.

### showbcc.js
Adds a custom header ("X-bcc") containing recipients in blind carbon copy. Useful when you have apps sending emails with hidden recipients and you want to test that everything is working fine.
Requires <strong>underscore</strong>.

### maildir.js
Implements a rudimental maildir backend for your smtp server, readable by other mail servers, like Dovecot.
The third party server can be used to serve emails to clients using pop or imap. Requires <strong>mkdirp</strong>.
