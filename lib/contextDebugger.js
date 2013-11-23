var debug = require('debug')('unum:context');

module.exports = function(ctx) {
  debug('Context:',ctx.req.url);
  var c = ctx;
  while(c) {
    debug(Object.keys(c));
    c = c.__proto__;
  }
  return ctx.next();
};