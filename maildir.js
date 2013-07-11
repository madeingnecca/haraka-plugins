var os = require('os');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

/**
 * Saves email when the smtp server enqueues it.
 */
exports.hook_queue = function (next, connection) {
  var t = connection.transaction;
  var cfg = this.config.get('maildir.ini', 'ini');
  var e = extractEmail;

  var mail_from = e(t.mail_from.original);
  var rcpt_to = t.rcpt_to.map(function (to) {
    return to.user + '@' + to.host;
  });

  var maildir = new Maildir(cfg.main, connection);
  var stream = t.message_stream;

  var forced;
  if (forced = t.header.get('x-maildir')) {
    //Maildir user forced by header.
    maildir.maildir(forced).messageStream(stream, next);
  }
  else {
    //Populate ".Sent" dir of sender.
    maildir.maildir(mail_from, '.Sent').messageStream(stream, function () {
      //Populate Inbox of each recipient.
      (function nextRcpt(i, cb) {
        if (i == rcpt_to.length) {
          cb();
        }
        else {
          maildir.maildir(rcpt_to[i]).messageStream(stream, function () {
            nextRcpt(i + 1, cb);
          });
        }
      }(0, next));
    });
  }
};

/**
 * Object for managing maildirs.
 * @param {hash} cfg
 */
function Maildir(cfg, conn) {
  this.cfg = cfg;
  this.connection = conn;
}

/**
 * Unique Name of the file inside the maildir.
 * Thanks: http://cr.yp.to/proto/maildir.html
 * @return {string}
 */
Maildir.prototype.fileName = function () {
  // For filename uniqueness, connection uuid is used.
  var uuid = this.connection.uuid;
  var d = new Date();
  var name = d.valueOf() + '.' + uuid + '.' + os.hostname();
  return name;
};

Maildir.prototype.maildir = function (user, folder) {
  var self = this;
  var userParts = user.split('@');
  var name = userParts[0], domain = userParts[1];
  var mode;

  return {
    ready: function (callback) {
      var fileName = self.fileName();
      var dirs = ['tmp', 'cur', 'new'];
      var maildir = self.cfg.maildir_path;
      mode = parseInt(self.cfg.maildir_mode, 8);

      var replace = {d: domain, n: name};
      for (var v in replace) {
        maildir = maildir.replace('%' + v, replace[v]);
      }

      //Checks if maildir location is relative to haraka.
      //FIXME: only works on *nix systems.
      if ('/' !== maildir.charAt(0)) {
        maildir = path.join(process.env.HARAKA, maildir);
      }

      var f = {};
      dirs.forEach(function (dir) {
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
        fs.exists(dir, function (exists) {
          if (exists) {
            nextDir(i + 1, cb);
          }
          else {
            mkdirp(dir, mode, function (err) {
              if (err) {
                throw err;
              }
              nextDir(i + 1, cb);
            });
          }
        });
      }(0, function () {
        callback(f, fileName);
      }));
    },
    messageStream: function (stream, callback) {
      this.ready(function (f, name) {
        var fileStream = fs.createWriteStream(f['tmp'], {flags: 'w'});
        stream.pipe(fileStream);
        fileStream.on('finish', function() {
          fs.link(f['tmp'], f['new'], function (err) {
            if (err) {
              throw err;
            }
            fs.unlink(f['tmp'], function (err) {
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
}

function extractEmail(email) {
  var emailRegexp = /([^<@\s,]+@[^@>,\s]+)/;
  var match;

  if ((match = email.match(emailRegexp)) && match.length) {
    return match[1];
  }

  return null;
}
