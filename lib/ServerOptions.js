var fs = require('fs');
var path = require('path');
var env = require('../lib/config');
var NODE_ENV = (env.NODE_ENV === 'production');
var tlsPath = path.join(__dirname, '../', 'ssl', env.NODE_ENV);
var _ = require('lodash');
var certPath;

try {
  certPath = fs.statSync(tlsPath);
}
catch (e) {
  throw new Error('Certificate directory cannot be found at ' + tlsPath);
}

var tlsKeyPath = path.join(tlsPath, env.octorp_ssl_key);
var tlsCertPath = path.join(tlsPath, env.octorp_ssl_cert);

var serverOpts = {};
serverOpts.sslPort = NODE_ENV ? 443 : env.octorp_dev_ssl_port;
serverOpts.port = NODE_ENV ? 80 : env.octorp_dev_non_ssl_port;
serverOpts.bindAddress = env.octorp_bind_address;

serverOpts.tlsOptions = {
  key: fs.readFileSync(tlsKeyPath),
  cert: fs.readFileSync(tlsCertPath)
};

if(NODE_ENV) {
  /*
   * In production we will most likely need a certificate chain to go along with
   * our cert and key.
   */
  var tlsCertChain = env.octorp_cert_chain.replace(/ /g, '').split(',');
  tlsCertChain = _.map(tlsCertChain, function(file) {
    return fs.readFileSync(path.join(tlsPath, file))
  });

  _.extend(serverOpts.tlsOptions, {ca: tlsCertChain});
}

module.exports = serverOpts;