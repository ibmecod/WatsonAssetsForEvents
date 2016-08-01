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

var express  = require('express'),
  app        = express(),
  path       = require('path'),
  bluemix    = require('./config/bluemix'),
  extend     = require('util')._extend,
  watson     = require('watson-developer-cloud');

// Bootstrap application settings
require('./config/express')(app);

// if bluemix credentials exists, then override local
var credentials =  extend({
  url: 'https://gateway.watsonplatform.net/dialog/api',
  username: '<paste credentials from Bluemix here>',
  password: '<paste credentials from Bluemix here>',
  version: 'v1'
}, bluemix.getServiceCreds('dialog')); // VCAP_SERVICES

var dialog_id = process.env.DIALOG_ID || '<paste dialog_id here>';

// Create the service wrapper
var dialog = watson.dialog(credentials);

// add NLC call
var nlc_credentials =  extend({
  url: 'https://gateway.watsonplatform.net/natural-language-classifier/api',
  username: '<paste credentials from Bluemix here>',
  password: '<paste credentials from Bluemix here>',
  version: 'v1'
}, bluemix.getServiceCreds('natural_language_classifier')); // VCAP_SERVICES
var nlc = watson.natural_language_classifier(nlc_credentials);

var nlc_id = process.env.NLC_ID || '<paste NLC_ID here>';
//create 'global' variable to track whether or not we need to call the classifier.
var use_nlc = false;

app.post('/conversation', function(req, res, next) {
  //req.body = {'input': 'olives'...}
  var params = extend({ dialog_id: dialog_id }, req.body);
  var dialogresp = JSON.stringify(params.response);

  if(use_nlc === true){
    //we have determined (via profile variable) that dialog wants us to call the classifier to determine
    //if the weather input is good or bad
    use_nlc = false; 
    //reset var to false so we go back to regular dialog the next time round.
    nlc.classify({text: req.body.input, classifier_id: nlc_id}, function(err, classifyResponse){
        if(classifyResponse && classifyResponse.top_class){ 
          //get the top class from classifier and set that as input for dialog
          //the class will be 'good' or 'bad'.. This will determine whether dialog says it will
          //deliver or pick up
           req.body.input = classifyResponse.top_class; 
           params = extend({ dialog_id: dialog_id }, req.body);
           dialog.conversation(params, function(err, results) {
           if (err)
            return next(err);
           else{
            //just call dialog
              res.json({ dialog_id: dialog_id, conversation: results});
              var profileParams = extend({ dialog_id: dialog_id, client_id: results.client_id, name:'useClassifier'}, req.body);
              dialog.getProfile(profileParams, function(err, profile){
                var profileVars = JSON.stringify(profile);
                console.log(profileVars);

                var name_values = profile.name_values;
                if(name_values){
                  for(var x = 0; x < name_values.length; x++){
                    if(name_values[x] && name_values[x].name){
                      if(name_values[x].value === 'YES'){
                        use_nlc = true;
                      }
                    } 
                  }
                }
              });
            }
         });
        }

    });
  }else {
    //call dialog
   dialog.conversation(params, function(err, results) {
     if (err)
      return next(err);
     else{
        res.json({ dialog_id: dialog_id, conversation: results});
        var profileParams = extend({ dialog_id: dialog_id, client_id: results.client_id}, req.body);
        dialog.getProfile(profileParams, function(err, profile){
          var profileVars = JSON.stringify(profile);
          console.log(profileVars);

          var name_values = profile.name_values;
          //get a list of profile variables..
          if(name_values){
            //we want to find out if dialog wants us to use classifier.
            for(var x = 0; x < name_values.length; x++){
              if(name_values[x] && name_values[x].name){
                if(name_values[x].name === 'useClassifier' && name_values[x].value === 'YES'){
                  use_nlc = true;
                  profileParams.name_values = [{'name': 'useClassifier', 'value': 'NO'}];
                  dialog.updateProfile(params);//reset profile variable to false.
                  break;
                }
              } 
            }
          }
        });
      }
   });
 }
  
});

app.post('/profile', function(req, res, next) {
  var params = extend({ dialog_id: dialog_id }, req.body);
  dialog.getProfile(params, function(err, results) {
    if (err)
      return next(err);
    else
      res.json(results);
  });
});

// error-handler settings
require('./config/error-handler')(app);

var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);
