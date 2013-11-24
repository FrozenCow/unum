var unum = require('../index.js');

// A new web-application can be defined with a base-context. This
// can hold any information that handlers would like to have when
// handling requests.
var app = new unum.WebApplication({
  // The base context that all other contexts inherit from.
  serverlevel: 'this is an property defined at server-level'

  // Practically you could define properties here like:
  // * Database connection
  // * Configuration from a file
  // * Command-line parameters
  // * Caching storage
});

app.use(function(ctx) {
  // Handler that adds information for the current request.
  ctx.requestlevel = 'this is an property defined at request-level';

  // Practically here properties are added like:
  // * Session-object
  // * User/login information

  ctx.next();
});

app.get('/',function(ctx) {
  // From this handler all variables are accessible
  console.log(ctx.serverlevel);
  console.log(ctx.requestlevel);
  ctx.res.end();
});

app.listen(8080);