#!/bin/bash -e
set -x

# Script to install everything needed to build chromium (well, ideally, anyway)
# streamer pc: video socket key socket
# usage lannch.sh video port key port [feed port]
usage() { 
	echo "Usage: $0 -v <ip:port> [-k <ip:port>] [-f <1234>] [-w <1234>]"; exit 1; 
}

# Checks whether a particular package is available in the repos.
# USAGE: $ package_exists <package name>
package_exists() {
  apt-cache pkgnames | grep -x "$1" > /dev/null 2>&1
}

is_empty() {
    test -z "$1";
}

VIDEO_PORT=""
KEY_PORT=""
FEED_PORT=8554
WS_PORT=""

while getopts ":v:k:f:w" o; do
    case "${o}" in
        v)
            VIDEO_PORT=${OPTARG}
            ;;
        k)
            KEY_PORT=${OPTARG}
            ;;
        f)
            FEED_PORT=${OPTARG}
            ;;
        w)
            WS_PORT=${OPTARG}
            ;;
        *)
            usage
            ;;
    esac
done

if is_empty $VIDEO_PORT; then
    usage
fi

if ! package_exists vlc; then
  sudo apt-get install vlc | exit 1
fi
if ! package_exists websockify; then
  sudo apt-get install websockify | exit 1
fi

sudo service kurento-media-server-6.0 start

IP=$(ifconfig eth0 | grep addr: | awk '{ print ip=$2 }' | cut -d: -f2)

TCD="transcode{vcodec=h264,venc=x264{preset=ultrafast,tune=zerolatency,intra-refresh,lookahead=10,keyint=15},scale=auto,acodec=mpga,ab=128}:"
FEED="#rtp{sdp=rtsp://$IP:$FEED_PORT/testfeed}"
RTP_OPTIONS="--sout-rtp-caching 50 --network-caching 50 --rtsp-tcp"

if ! is_empty $WS_PORT; then
    echo "Will start websocket proxy to $KEY_PORT and on local port $WS_PORT";
    echo "websockify -v --web=. $IP:$WS_PORT $KEY_PORT"

    websockify -v --web=. $IP:$WS_PORT $KEY_PORT &
fi

echo "Will start streaming video from $VIDEO_PORT and serve it on local port $FEED";
sleep 5

#nc -l -p 9090 < t.mp4 &

cvlc -vvv tcp/h264://$VIDEO_PORT $RTP_OPTIONS --sout $FEED


