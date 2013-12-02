var os = require('os');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var util = require('util');

/**
 * Saves email when the smtp server enqueues it.
 */
exports.hook_queue = function(next, connection) {
  var accept = function() {
    next(OK);
  };

  var plugin = this;
  var t = connection.transaction;
  var cfg = this.config.get('maildir.ini', 'ini');

  var mail_from = extractEmail(t.mail_from.original);
  var rcpt_to = t.rcpt_to.map(function(to) {
    return to.user + '@' + to.host;
  });

  var maildir = new Maildir(cfg.main, this, connection);
  var stream = t.message_stream;

  // If an x-maildir header was supplied then
  // populate only that maildir and stop.
  var forced = trim(t.header.get('x-maildir-rcpt'));
  if (forced) {
    maildir.maildir({user: forced}).messageStream(stream, accept);
    return;
  }

  // Collect mailboxes.
  var mailboxes = [];

  // Sender could be empty ("<>" value) in some bounce messages.
  // Thanks Koshroy.
  if (mail_from) {
    // Populate ".Sent" dir of sender.
    mailboxes.push({
      user: mail_from,
      folder: '.Sent',
    });
  }
  else {
    this.logdebug('Mail from is empty, probably this is a bounce message.');
  }

  rcpt_to.forEach(function(email) {
    mailboxes.push({user: email});
  });

  // Process mailboxes.
  (function nextMailbox(i, cb) {
    if (i == mailboxes.length) {
      cb();
    }
    else {
      maildir.maildir(mailboxes[i]).messageStream(stream, function() {
        nextMailbox(i + 1, cb);
      });
    }
  }(0, accept));
};

/**
 * Object for managing maildirs.
 * @param {hash} cfg
 */
function Maildir(cfg, plugin, conn) {
  this.cfg = cfg;
  this.plugin = plugin;
  this.connection = conn;
}

/**
 * Unique name of the file inside the maildir.
 * Thanks: http://cr.yp.to/proto/maildir.html
 *
 * @return {string}
 */
Maildir.prototype.fileName = function() {
  // For filename uniqueness, connection uuid is used.
  var uuid = this.connection.uuid;
  var d = new Date();
  var name = d.valueOf() + '.' + uuid + '.' + os.hostname();
  return name;
};

Maildir.prototype.maildir = function(params) {
  var self = this;
  var user = params.user;
  var folder = params.folder;
  var userParts = user.split('@');
  var name = userParts[0], domain = userParts[1];
  var mode;

  return {
    ready: function(callback) {
      var fileName = self.fileName();
      var dirs = ['tmp', 'cur', 'new'];
      var maildir = self.cfg.maildir_path;
      mode = parseInt(self.cfg.maildir_mode, 8);

      var replace = {d: domain, n: name};
      var v;
      for (v in replace) {
        maildir = maildir.replace('%' + v, replace[v]);
      }

      // Checks if maildir location is relative to haraka.
      // FIXME: only works on *nix systems.
      if ('/' !== maildir.charAt(0)) {
        maildir = path.join(process.env.HARAKA, maildir);
      }

      var f = {};
      dirs.forEach(function(dir) {
        var parts = [maildir];
        if (folder) {
          parts.push(folder);
        }
        parts.push(dir);
        parts.push(fileName);
        f[dir] = path.join.apply(path, parts);
      });

      (function nextDir(i, cb) {
        if (i === dirs.length) {
          return cb();
        }

        var dir = path.dirname(f[dirs[i]]);
        fs.exists(dir, function(exists) {
          if (exists) {
            nextDir(i + 1, cb);
          }
          else {
            mkdirp(dir, mode, function(err) {
              if (err) {
                throw err;
              }
              nextDir(i + 1, cb);
            });
          }
        });
      }(0, function() {
        self.plugin.logdebug('Maildir ready: ' + util.format('%j, %s', f, fileName));
        callback(f, fileName);
      }));
    },
    messageStream: function(stream, callback) {
      this.ready(function(f, name) {
        var fileStream = fs.createWriteStream(f['tmp'], {flags: 'w'});
        stream.pipe(fileStream);
        fileStream.on('finish', function() {
          fs.link(f['tmp'], f['new'], function(err) {
            if (err) {
              throw err;
            }
            fs.unlink(f['tmp'], function(err) {
              if (err) {
                throw err;
              }
              callback();
            });
          });
        });
      });
    }
  };
};

/**
 * Extracts the email from a recipient address (USER <EMAIL>).
 * See "Address Specification" in http://tools.ietf.org/html/rfc2822.
 *
 * @param  {string} rcpt the recipient
 * @return {string}      the extracted email.
 */
function extractEmail(rcpt) {
  var emailRegexp = /([^<@\s,]+@[^@>,\s]+)/;
  var match;

  if ((match = rcpt.match(emailRegexp)) && match.length) {
    return match[1];
  }

  return null;
}


/**
 * Removes both leading and trailing whitespaces
 * from a string.
 *
 * @param  {string} string
 * @return {string}
 */
function trim(string) {
  return string.replace(/^\s+|\s+$/g, '');
}
