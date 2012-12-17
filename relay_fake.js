/**
 * Let's pretend we can deliver mail to these recipients.
 * Solves: "450 I cannot deliver mail for {user@domain}"
 */
exports.hook_rcpt = function(next, connection) {
  return next(OK);
}

/**
 * Let's pretend we can successfully enqueue the message.
 * Solves: "451 Queuing declined or disabled, try later"
 */
exports.hook_queue = function(next, connection) {
  return next(OK);
}
