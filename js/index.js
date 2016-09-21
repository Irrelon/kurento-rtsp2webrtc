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
	address.value = 'rtsp://localhost:8554/testfeed';
  var kaddress = document.getElementById('kaddress');
  kaddress.value = 'ws://host:8555';

  var pipeline;
  var webRtcPeer;

  startButton = document.getElementById('start');
  startButton.addEventListener('click', start);

  stopButton = document.getElementById('stop');
  stopButton.addEventListener('click', stop);

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
            min: 1280,
            max: 1280
        },
        height: {
            min: 720,
            max: 720
        },
        frameRate: {
            min: 30
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

  			pipeline.create("PlayerEndpoint", {uri: address.value}, function(error, player){
  			  if(error) return onError(error);

  			  pipeline.create("WebRtcEndpoint", function(error, webRtcEndpoint){
  				if(error) return onError(error);

          setIceCandidateCallbacks(webRtcEndpoint, webRtcPeer, onError);

          webRtcEndpoint.setMaxVideoRecvBandwidth(0);
          webRtcEndpoint.setMinVideoSendBandwidth(500);
          webRtcEndpoint.setMaxVideoSendBandwidth(0);
          console.log("webRtcEndpoint getMinVideoRecvBandwidth " + webRtcEndpoint.getMinVideoRecvBandwidth());
          console.log("webRtcEndpoint getMinVideoSendBandwidth " + webRtcEndpoint.getMinVideoSendBandwidth());
          console.log("webRtcEndpoint getMaxVideoSendBandwidth " + webRtcEndpoint.getMaxVideoSendBandwidth());


  				webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer){
  					if(error) return onError(error);

            webRtcEndpoint.gatherCandidates(onError);

  					webRtcPeer.processAnswer(sdpAnswer);
  				});

  				player.connect(webRtcEndpoint, function(error){
  					if(error) return onError(error);

  					console.log("PlayerEndpoint-->WebRtcEndpoint connection established");

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
