var qs = require('qs');
module.exports = function(ctx) {
  ctx.query = qs.parse(ctx.url.query);
  ctx.next();
};