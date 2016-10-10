#!/bin/bash -e

# Script to install everything needed to build chromium (well, ideally, anyway)
# streamer pc: video socket key socket
# usage lannch.sh video port key port [feed port]
usage() { 
	echo "Usage: $0 -v <ip:port> -k <ip:port> [-f <1234>]"; exit 1; 
}

VIDEO_PORT=""
KEY_PORT=""
FEED_PORT=8554


while getopts ":v:k:f:" o; do
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
        *)
            usage
            ;;
    esac
done


# Checks whether a particular package is available in the repos.
# USAGE: $ package_exists <package name>
package_exists() {
  apt-cache pkgnames | grep -x "$1" > /dev/null 2>&1
}

if ! package_exists vlc; then
  sudo apt-get install vlc | exit 1
fi

sudo service kurento-media-server-6.0 start

IP=$(ifconfig eth0 | grep addr: | awk '{ print ip=$2 }' | cut -d: -f2)

FEED="#rtp{sdp=rtsp://$IP:$FEED_PORT/testfeed}"

echo "will start streaming video from $VIDEO_PORT and serve it on feed $FEED";
sleep 5

cvlc -vvv tcp/h264://$VIDEO_PORT --sout $FEED
