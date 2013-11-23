var cookie = require('cookie');

module.exports = function cookieParser(ctx) {
  var req = ctx.req;
  var next = ctx.next;
  if (req.cookies) { return next(); }
  var cookies = req.headers.cookie;

  req.cookies = {};

  if (cookies) {
    try {
      req.cookies = cookie.parse(cookies);
    } catch (err) {
      err.status = 400;
      return next(err);
    }
  }
  return next();
};
