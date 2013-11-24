var unum = require('../index.js');

var app = new unum.WebApplication();

app.get('/user/:username',function(ctx) {
  var username = ctx.params.username;
  console.log('Requested user', username);
  ctx.res.end('Information about ' + username);
});

app.listen(8080);