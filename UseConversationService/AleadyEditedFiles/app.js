/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

require( 'dotenv' ).config( {silent: true} );

var express = require( 'express' );  // app server
var bodyParser = require( 'body-parser' );  // parser for post requests
var watson = require( 'watson-developer-cloud' );  // watson sdk
var http = require ('http');

// The following requires are needed for logging purposes
var uuid = require( 'uuid' );
var vcapServices = require( 'vcap_services' );
var basicAuth = require( 'basic-auth-connect' );

// The app owner may optionally configure a cloudand db to track user input.
// This cloudand db is not required, the app will operate without it.
// If logging is enabled the app must also enable basic auth to secure logging
// endpoints
var cloudantCredentials = vcapServices.getCredentials( 'cloudantNoSQLDB' );
var cloudantUrl = null;
if ( cloudantCredentials ) {
  cloudantUrl = cloudantCredentials.url;
}
cloudantUrl = cloudantUrl || process.env.CLOUDANT_URL; // || '<cloudant_url>';
var logs = null;
var app = express();

// Bootstrap application settings
app.use( express.static( './public' ) ); // load UI from public folder
app.use( bodyParser.json() );

// Create the service wrapper
var conversation = watson.conversation( {
  url: 'https://gateway.watsonplatform.net/conversation/api',
  username: process.env.CONVERSATION_USERNAME || '<username>',
  password: process.env.CONVERSATION_PASSWORD || '<password>',
  version_date: '2016-07-11',
  version: 'v1'
} );

// Endpoint to be call from the client side
app.post( '/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if ( !workspace || workspace === '<workspace-id>' ) {
    return res.json( {
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' +
        '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' +
        'Once a workspace has been defined the intents may be imported from ' +
        '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    } );
  }
  var payload = {
    workspace_id: workspace,
    context: {},
    input: {}
  };
  if ( req.body ) {
    if ( req.body.input ) {
      payload.input = req.body.input;
    }
    if ( req.body.context ) {
      // The client must maintain context/state
      payload.context = req.body.context;
    }
  }
  // Send the input to the conversation service
  conversation.message( payload, function(err, data) {
    if ( err ) {
      return res.status( err.code || 500 ).json( err );
    }
    updateMessage(res, payload, data);
  } );
} );

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(res, input, data){
  if(checkWeather(data)){
    var path = getLocationURL(data.context.long, data.context.lat);

    var options = {
      host: 'api.wunderground.com',
      path: path
    };

    http.get(options, function(resp){
      var chunkText = '';
      resp.on('data', function(chunk){
        chunkText += chunk.toString('utf8');
      });
      resp.on('end', function(){
        var chunkJSON = JSON.parse(chunkText);
        var params = [];
        if(chunkJSON.location) {
          var when = data.entities[0].value;
          params.push ( chunkJSON.location.city );
          var forecast = null;
          if ( when == 'today' ) {
            forecast = chunkJSON.forecast.txt_forecast.forecastday[0].fcttext;
          } else if ( when == 'tomorrow' ) {
            forecast = chunkJSON.forecast.txt_forecast.forecastday[3].fcttext;
          }
          params.push ( forecast );

          data.output.text = replaceParams ( data.output.text, params );
        }
        return res.json(data);
      });
    }).on('error', function(e){
      console.log("failure!");
    });
  }
  else{
    return res.json(data);
  }
}
function checkWeather(data){
  return data.intents && data.intents.length > 0 && data.intents[0].intent === 'weather'
    && data.entities && data.entities.length > 0 && data.entities[0].entity === 'day';
}

function replaceParams(original, args){
  if(original && args){
    var text = original.join(' ').replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
        ;
    });
    return [text];
  }
  return original;
}

function getLocationURL(lat, long){
  if(lat != null && long != null){
    return '/api/' + key + '/geolookup/forecast/q/'  + long + ',' + lat + '.json';
  }
};

var key = //"add your key in between the double quotes"; (and the semi colon at the end)


module.exports = app;
