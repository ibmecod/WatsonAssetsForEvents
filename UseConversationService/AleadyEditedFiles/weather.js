
  
//Client JS Code.. Add this to conversation.js, overwriting the init function with this
//new init function
  // Initialize the module
  function init() {
    chatUpdateSetup();
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(geoSuccess, geoError);
    }
    else{
      console.log("Browser geolocation isn't supported.");
      geoSuccess(position)
    }
    setupInputBox();
  }

  //private functions
  function geoSuccess(position){
    var context = null;
    if(position && position.coords){
      context = {};
      context.long = position.coords.longitude;
      context.lat = position.coords.latitude;
    }
    // The client displays the initial message to the end user
    Api.sendRequest("", context);
  };

  //Sends in null to ask for zip code
  function geoError(){
    geoSuccess(null);
  };


//modify the callback from conversation to call updateResponse(res, data)

//NODE JS CODE.. ADD this to app.js
// Add var http = require('http'); at the top of the file..
//update "return res.json( updateMessage( payload, data ) );"" to be.....

    updateMessage(res, payload, data);

    //Add the following new functions


/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(res, input, data) {
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
          } else{
            forecast = chunkJSON.forecast.txt_forecast.forecastday[0].fcttext;
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

var key = //"add your key here";





