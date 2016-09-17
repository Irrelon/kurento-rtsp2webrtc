https://gilesbathgate.com/2007/11/30/streaming-video-using-netcat/
Server:
	nc -l -p 8081 < trail.mp4 & 
	websockify -v --web=. 8082 localhost:8081

Client:
	nc 127.0.0.1 8080 | mplayer -cache 8192 -

bof: https://shanetully.com/2014/09/a-dead-simple-webrtc-example/

http://doc-kurento.readthedocs.io/en/stable/installation_guide.html

sudo service kurento-media-server-6.0 start

https://github.com/lulop-k/kurento-rtsp2webrtc 

rtsp://mpv.cdn3.bigCDN.com:554/bigCDN/definst/mp4:bigbuckbunnyiphone_400.mp4

vlc -vvv tcp://192.168.88.128:9090 --sout '#rtp{sdp=rtsp://localhost:9999/stream}'
