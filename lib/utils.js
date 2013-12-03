var parse = require('url').parse;

function parseUrl(req){
  var parsed = req._parsedUrl;
  if (parsed && parsed.href == req.url) {
    return parsed;
  } else {
    parsed = req._parsedUrl = parse(req.url);
    return parsed;
  }
}

module.exports = {
  parseUrl: parseUrl
};