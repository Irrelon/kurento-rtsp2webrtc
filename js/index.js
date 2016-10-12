/*
* (C) Copyright 2014 Kurento (http://kurento.org/)
*
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the GNU Lesser General Public License
* (LGPL) version 2.1 which accompanies this distribution, and is available at
* http://www.gnu.org/licenses/lgpl-2.1.html
*
* This library is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
* Lesser General Public License for more details.
*
*/

function getopts(args, opts)
{
  var result = opts.default || {};
  args.replace(
      new RegExp("([^?=&]+)(=([^&]*))?", "g"),
      function($0, $1, $2, $3) { result[$1] = $3; });

  return result;
};

var args = getopts(location.search,
{
  default:
  {
    ws_uri: 'ws://' + location.hostname + ':8888/kurento',
    ice_servers: undefined
  }
});

if (args.ice_servers) {
  console.log("Use ICE servers: " + args.ice_servers);
  kurentoUtils.WebRtcPeer.prototype.server.iceServers = JSON.parse(args.ice_servers);
} else {
  console.log("Use freeice")
}

var KEYS = { 
    /*BACK/backspace*/ 8:273, 
    /*HOME/ESC*/ 27:102, 
    /*UP*/38:103, 
    /*LEFT*/37:105, 
    /*RIGHT*/39:106, 
    /*DOWN*/40:108, 
    /*OK/ENTER*/13:272, 
    /*PLAY/SPACE*/32:40164
  };

var kWebsocket = null;

function checkKeyPressed(e) {
  if (!kWebsocket) return;
  e = e || window.event;
  console.log("keypress " + e.keyCode);

  if (KEYS.hasOwnProperty(e.keyCode))
    kWebsocket.send("PRESSED," + KEYS[e.keyCode]); 
};

window.addEventListener("keydown", checkKeyPressed, false);

window.addEventListener('load', function(){
  console = new Console('console', console);
	var videoOutput = document.getElementById('videoOutput');
	var address = document.getElementById('address');
  var kaddress = document.getElementById('kaddress');

  var pipeline;
  var webRtcPeer;
  var webRtcEndpoint;

  startButton = document.getElementById('start');
  startButton.addEventListener('click', start);

  stopButton = document.getElementById('stop');
  stopButton.addEventListener('click', stop);

  function activateStatsTimeout() {
    setTimeout(function() {
      if (!webRtcPeer || !pipeline) return;
      printStats();
      activateStatsTimeout();
    }, 1000);
  }

  function printStats() {

    getBrowserOutgoingVideoStats(webRtcPeer, function(error, stats) {
      if (error) return console.log("Warning: could not gather browser outgoing stats: " + error);

      document.getElementById('browserOutgoingSsrc').innerHTML = stats.ssrc;
      document.getElementById('browserBytesSent').innerHTML = stats.bytesSent;
      document.getElementById('browserPacketsSent').innerHTML = stats.packetsSent;
      document.getElementById('browserPliReceived').innerHTML = stats.pliCount;
      document.getElementById('browserFirReceived').innerHTML = stats.firCount;
      document.getElementById('browserNackReceived').innerHTML = stats.nackCount;
      document.getElementById('browserRtt').innerHTML = stats.roundTripTime;
      document.getElementById('browserOutboundPacketsLost').innerHTML = stats.packetsLost;
    });

    getMediaElementStats(webRtcEndpoint, 'inboundrtp', 'VIDEO', function(error, stats) {
      if (error) return console.log("Warning: could not gather webRtcEndpoint input stats: " + error);

      document.getElementById('kmsIncomingSsrc').innerHTML = stats.ssrc;
      document.getElementById('kmsBytesReceived').innerHTML = stats.bytesReceived;
      document.getElementById('kmsPacketsReceived').innerHTML = stats.packetsReceived;
      document.getElementById('kmsPliSent').innerHTML = stats.pliCount;
      document.getElementById('kmsFirSent').innerHTML = stats.firCount;
      document.getElementById('kmsNackSent').innerHTML = stats.nackCount;
      document.getElementById('kmsJitter').innerHTML = stats.jitter;
      document.getElementById('kmsPacketsLost').innerHTML = stats.packetsLost;
      document.getElementById('kmsFractionLost').innerHTML = stats.fractionLost;
      document.getElementById('kmsRembSend').innerHTML = stats.remb;
    });

    getBrowserIncomingVideoStats(webRtcPeer, function(error, stats) {
      if (error) return console.log("Warning: could not gather stats: " + error);
      document.getElementById('browserIncomingSsrc').innerHTML = stats.ssrc;
      document.getElementById('browserBytesReceived').innerHTML = stats.bytesReceived;
      document.getElementById('browserPacketsReceived').innerHTML = stats.packetsReceived;
      document.getElementById('browserPliSent').innerHTML = stats.pliCount;
      document.getElementById('browserFirSent').innerHTML = stats.firCount;
      document.getElementById('browserNackSent').innerHTML = stats.nackCount;
      document.getElementById('browserJitter').innerHTML = stats.jitter;
      document.getElementById('browserIncomingPacketLost').innerHTML = stats.packetLost;
    });

    getMediaElementStats(webRtcEndpoint, 'outboundrtp', 'VIDEO', function(error, stats){
      if (error) return console.log("Warning: could not gather webRtcEndpoint output stats: " + error);

      document.getElementById('kmsOutogingSsrc').innerHTML = stats.ssrc;
      document.getElementById('kmsBytesSent').innerHTML = stats.bytesSent;
      document.getElementById('kmsPacketsSent').innerHTML = stats.packetsSent;
      document.getElementById('kmsPliReceived').innerHTML = stats.pliCount;
      document.getElementById('kmsFirReceived').innerHTML = stats.firCount;
      document.getElementById('kmsNackReceived').innerHTML = stats.nackCount;
      document.getElementById('kmsRtt').innerHTML = stats.roundTripTime;
      document.getElementById('kmsRembReceived').innerHTML = stats.remb;
    });

    getMediaElementStats(webRtcEndpoint, 'endpoint', 'VIDEO', function(error, stats){
      if(error) return console.log("Warning: could not gather webRtcEndpoint endpoint stats: " + error);
      document.getElementById('e2eLatency').innerHTML = stats.videoE2ELatency / 1000 + " milliseconds";
    });
  }


  function getBrowserOutgoingVideoStats(webRtcPeer, callback) {
    if (!webRtcPeer) return callback("Cannot get stats from null webRtcPeer");
    var peerConnection = webRtcPeer.peerConnection;
    if (!peerConnection) return callback("Cannot get stats from null peerConnection");
    var localVideoStream = peerConnection.getLocalStreams()[0];
    if (!localVideoStream) return callback("Non existent local stream: cannot read stats")
    var localVideoTrack = localVideoStream.getVideoTracks()[0];
    if (!localVideoTrack) return callback("Non existent local video track: cannot read stats");

    peerConnection.getStats(function(stats) {
      var results = stats.result();
      for (var i = 0; i < results.length; i++) {
        var res = results[i];
        if (res.type != 'ssrc') continue;

        //Publish it to be compliant with W3C stats draft
        var retVal = {
          timeStamp: res.timestamp,
          //StreamStats below
          associateStatsId: res.id,
          codecId: "--",
          firCount: res.stat('googFirsReceived'),
          isRemote: false,
          mediaTrackId: res.stat('googTrackId'),
          nackCount: res.stat('googNacksReceived'),
          pliCount: res.stat('googPlisReceived'),
          sliCount: 0,
          ssrc: res.stat('ssrc'),
          transportId: res.stat('transportId'),
          //Specific outbound below
          bytesSent: res.stat('bytesSent'),
          packetsSent: res.stat('packetsSent'),
          roundTripTime: res.stat('googRtt'),
          packetsLost: res.stat('packetsLost'),
          targetBitrate: "??",
          remb: "??"
        }
        return callback(null, retVal);
      }
      return callback("Error: could not find ssrc type on track stats", null);
    }, localVideoTrack);
  }

  function getBrowserIncomingVideoStats(webRtcPeer, callback) {
    if (!webRtcPeer) return callback("Cannot get stats from null webRtcPeer");
    var peerConnection = webRtcPeer.peerConnection;
    if (!peerConnection) return callback("Cannot get stats from null peerConnection");
    var remoteVideoStream = peerConnection.getRemoteStreams()[0];
    if (!remoteVideoStream) return callback("Non existent remote stream: cannot read stats")
    var remoteVideoTrack = remoteVideoStream.getVideoTracks()[0];
    if (!remoteVideoTrack) return callback("Non existent remote video track: cannot read stats");

    peerConnection.getStats(function(stats) {
      var results = stats.result();
      for (var i = 0; i < results.length; i++) {
        var res = results[i];
        if (res.type != 'ssrc') continue;

        //Publish it to be compliant with W3C stats draft
        var retVal = {
          timeStamp: res.timestamp,
          //StreamStats below
          associateStatsId: res.id,
          codecId: "--",
          firCount: res.stat('googFirsSent'),
          isRemote: true,
          mediaTrackId: res.stat('googTrackId'),
          nackCount: res.stat('googNacksSent'),
          pliCount: res.stat('googPlisSent'),
          sliCount: 0,
          ssrc: res.stat('ssrc'),
          transportId: res.stat('transportId'),
          //Specific outbound below
          bytesReceived: res.stat('bytesReceived'),
          packetsReceived: res.stat('packetsReceived'),
          jitter: res.stat('googJitterBufferMs'),
          packetLost: res.stat('packetsLost'),
          remb: "??"
        }
        return callback(null, retVal);
      }
      return callback("Error: could not find ssrc type on track stats", null);
    }, remoteVideoTrack);
  }

  /*
  Parameters:
  mediaElement: valid reference of a media element.
  statsType: one of
    inboundrtp
    outboundrtp
    datachannel
    element
    endpoint
  mediaType: one of
    AUDIO
    VIDEO
  */
  function getMediaElementStats(mediaElement, statsType, mediaType, callback){
    if (!mediaElement) return callback('Cannot get stats from null Media Element');
    if(!statsType) return callback('Cannot get stats with undefined statsType')
    if(!mediaType) mediaType = 'VIDEO'; //By default, video
    mediaElement.getStats(mediaType, function(error, statsMap){
      if(error) return callback(error);
      for(var key in statsMap){
        if(!statsMap.hasOwnProperty(key)) continue; //do not dig in prototypes properties

        stats = statsMap[key];
        if(stats.type != statsType) continue; //look for the type we want

        return callback(null, stats)
      }
      return callback('Cound not find ' +
                        statsType + ':' + mediaType +
                        ' stats in element ' + mediaElement.id);
    });
  }

  //Aux function used for printing stats associated to a track.
  function listStats(peerConnection, webRtcEndpoint) {
    var localVideoTrack = peerConnection.getLocalStreams()[0].getVideoTracks()[0];
    var remoteVideoTrack = peerConnection.getRemoteStreams()[0].getVideoTracks()[0];

    peerConnection.getStats(function(stats) {
      var results = stats.result();

      for (var i = 0; i < results.length; i++) {
        console.log("Iterating i=" + i);
        var res = results[i];
        console.log("res.type=" + res.type);
        var names = res.names();

        for (var j = 0; j < names.length; j++) {
          var name = names[j];
          var stat = res.stat(name);
          console.log("For name " + name + " stat is " + stat);
        }
      }
    }, remoteVideoTrack);
  }

  function startKeys() {
    console.log("Open socket on " + kaddress.value);

    kWebsocket = new Websock();
    kWebsocket.open(kaddress.value);
        
    kWebsocket.on('open', function()
    {
      kWebsocket.send("Message to send");
      console.log("socket open");
    });

    kWebsocket.on('message', function (evt) 
    { 
      var received_msg = evt.data;
      console.log("Message is received..." + msg);
    });

    kWebsocket.on('close', function()
    { 
      // websocket is closed.
      kWebsocket = null;
    });

  };  

  function stopKeys() {
    if (kWebsocket)
      kWebsocket.close();
  }; 

  function start() {
  	if(!address.value){
  	  window.alert("You must set the video source URL first");
  	  return;
  	}
    startKeys();
  	address.disabled = true;
  	showSpinner(videoOutput);

    var userMediaConstraints = {
      audio : false,
      video : {
        width: {
            min: 1280
        },
        height: {
            min: 720
        },
        frameRate: {
            min: 20
        }
      }
    }

    var options = {
      remoteVideo : videoOutput,
      mediaConstraints : userMediaConstraints      
    };
    webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
      function(error){
        if(error){
          return console.error(error);
        }
        webRtcPeer.generateOffer(onOffer);
        webRtcPeer.peerConnection.addEventListener('iceconnectionstatechange', function(event){
          if(webRtcPeer && webRtcPeer.peerConnection){
            console.log("oniceconnectionstatechange -> " + webRtcPeer.peerConnection.iceConnectionState);
            console.log('icegatheringstate -> ' + webRtcPeer.peerConnection.iceGatheringState);
          }
        });
    });
  }

  function onOffer(error, sdpOffer){
    if(error) return onError(error);

  	kurentoClient(args.ws_uri, function(error, kurentoClient) {
  		if(error) return onError(error);

  		kurentoClient.create("MediaPipeline", function(error, p) {
  			if(error) return onError(error);

  			pipeline = p;

        pipeline.setLatencyStats(true, function(error){
                    if (error) return onError(error);
                  });

  			pipeline.create("PlayerEndpoint", {uri: address.value}, function(error, player){
  			  if(error) return onError(error);

  			  pipeline.create("WebRtcEndpoint", function(error, endPoint){
  				if(error) return onError(error);

          webRtcEndpoint = endPoint;
          setIceCandidateCallbacks(webRtcEndpoint, webRtcPeer, onError);

          webRtcEndpoint.setMaxVideoRecvBandwidth(0);
          webRtcEndpoint.setMaxVideoSendBandwidth(0);
          webRtcEndpoint.setMaxOutputBitrate(0);
          console.log("webRtcEndpoint MinVideoRecvBandwidth " + webRtcEndpoint.getMaxVideoRecvBandwidth());
          console.log("webRtcEndpoint MaxVideoSendBandwidth " + webRtcEndpoint.getMaxVideoSendBandwidth());
          console.log("webRtcEndpoint MaxOutputBitrate " + webRtcEndpoint.getMaxOutputBitrate());


  				webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer){
  					if(error) return onError(error);

            webRtcEndpoint.gatherCandidates(onError);

  					webRtcPeer.processAnswer(sdpAnswer);
  				});

  				player.connect(webRtcEndpoint, function(error){
  					if(error) return onError(error);

  					console.log("PlayerEndpoint-->WebRtcEndpoint connection established");

            activateStatsTimeout();

  					player.play(function(error){
  					  if(error) return onError(error);

  					  console.log("Player playing ...");
  					});
  				});
  			});
  			});
  		});
  	});
  }

  function stop() {
    address.disabled = false;
    if (webRtcPeer) {
      webRtcPeer.dispose();
      webRtcPeer = null;
    }
    if(pipeline){
      pipeline.release();
      pipeline = null;
    }
    hideSpinner(videoOutput);
  }

});

function setIceCandidateCallbacks(webRtcEndpoint, webRtcPeer, onError){
  webRtcPeer.on('icecandidate', function(candidate){
    console.log("Local icecandidate " + JSON.stringify(candidate));

    candidate = kurentoClient.register.complexTypes.IceCandidate(candidate);

    webRtcEndpoint.addIceCandidate(candidate, onError);

  });
  webRtcEndpoint.on('OnIceCandidate', function(event){
    var candidate = event.candidate;

    console.log("Remote icecandidate " + JSON.stringify(candidate));

    webRtcPeer.addIceCandidate(candidate, onError);
  });
}

function onError(error) {
  if(error)
  {
    console.error(error);
    stop();
  }
}

function showSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].poster = 'img/transparent-1px.png';
		arguments[i].style.background = "center transparent url('img/spinner.gif') no-repeat";
	}
}

function hideSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].src = '';
		arguments[i].poster = 'img/webrtc.png';
		arguments[i].style.background = '';
	}
}

/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function(event) {
	event.preventDefault();
	$(this).ekkoLightbox();
});



