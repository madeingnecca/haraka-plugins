var path = require('path');
var _ = require('underscore')._;

exports.hook_queue = function(next, connection) {
  var transaction = connection.transaction;
  var addresses = this.addresses(transaction);
  var bccs = addresses.bcc();

  if (bccs.length) {
    transaction.add_header('X-bcc', bccs.join(', '));
  }

  next();
}

exports.addresses = function(transaction) {
  var t = transaction;
  var mailRegExp = /([^<@\s,]+@[^@>,\s]+)/;

  function get_addresses(key) {
    var result = [];
    t.header.get(key)
    .split(',')
    .forEach(function(val) {
      var match;
      if ((match = val.match(mailRegExp)) && match.length) {
        result.push(match[1]);
      }
    });
    return result;
  }

  return {
    rcpt_to: function() {
      return t.rcpt_to.map(function(rcpt_to) {
        return rcpt_to.user + '@' + rcpt_to.host;
      });
    },
    to: function() {
      return get_addresses('to');
    },
    cc: function() {
      return get_addresses('cc');
    },
    bcc: function() {
      var in_headers = this.to().concat(this.cc());
      var diff = _(this.rcpt_to()).difference(in_headers);
      return diff;
    }
  }
}