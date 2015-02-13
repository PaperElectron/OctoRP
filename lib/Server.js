var http = require('http');
var https = require('https');
var _ = require('lodash');
var url = require('url');
var env = require('../lib/config');
var path = require('path');
var fs = require('fs');
var NODE_ENV = (env.NODE_ENV === 'production');
var httpProxy = require('http-proxy');

var fourOfour = path.join(__dirname, '../','public/html/index.html');
var indexHtml = path.join(__dirname, '../','public/html/index.html');

module.exports = function(serverOptions, Router) {

  var proxy = httpProxy.createProxyServer();

  var proxyRoute = function(req, res){
    var parsedHeader = url.parse('https://'+req.headers.host).hostname;

    //Expire this request in a reasonable amount of time if something is hanging up downstream.
    res.setTimeout(1000, function() {
      console.log('wtf');
      res.writeHead(408);
      res.write('Sorry We couldn\'t complete that request in time.');
      return res.end();
    });

    //Return early if this route matches the default set in the config.
    if(parsedHeader === env.octorp_default_address) {
      res.writeHead(200,{'Content-Type': 'text/html'});
      return fs.createReadStream(indexHtml).pipe(res)
    }

    //Send our request host data to the Router to be looked up and cached if found.
    Router.findRoute(parsedHeader, function proxyRequest(data){
      console.log(data);
      if(data) {
        return proxy.web(req, res, {
          target: {
            host: data.host,
            port: data.port
          }
        }, function(err){
          res.writeHead(503);
          res.write('Sorry There was an error ' + err);
          res.end()
        });
      }

      res.writeHead(404,{'Content-Type': 'text/html'});
      return fs.createReadStream(fourOfour).pipe(res)
    })
  };


  /*
   * Handle http -> https redirects differently based on the current env.
   */
  var redirect = {
    production: function(req, res) {
      res.writeHead(301, {Location: 'https://' + req.headers.host + req.url});
      res.end()
    },
    development: function(req, res){
      var host = req.headers.host.split(':');
      host[host.length - 1] = env.octorp_dev_ssl_port;
      host = host.join(':');

      res.writeHead(301, {Location: 'https://' + host + req.url});
      res.end();
    }
  };
  var handleRedirect = NODE_ENV ? redirect.production : redirect.development;

  /*
   * Handler for dev/test response server, returns the current req.headers as well as url.
   */
  var testHandler = function(req, res){
    res.writeHead(200);
    res.write('Headers: ' + '\n');
    _.each(req.headers,function(head, key){
      res.write('    ' + key + ': ' + head + '\n');
    });
    res.write('url: \n    ' + req.url);
    res.end();
  };

  /*
   * Return a group of servers dependant on options and env.
   * at a bare minimum this will provide a server to 301 redirect http requests
   * to https, as well as our dynamic reverse proxying server over https.
   *
   * It will optionally return a server to test and develop against locally.
   */

  var serverGroup = {};
  serverGroup.http = http.createServer(handleRedirect);
  serverGroup.https = https.createServer(serverOptions.tlsOptions, proxyRoute);

  if(!NODE_ENV){
    _.extend(serverGroup, {test: http.createServer(testHandler)});
  }

  return serverGroup;
};