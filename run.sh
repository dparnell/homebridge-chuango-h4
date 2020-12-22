#!/bin/sh

docker run --rm --name homebridge --network host -e TZ=Australia/Sydney -e PGID=$(id -g) -e PUID=$(id -u) -e HOMEBRIDGE_CONFIG_UI=1 -e HOMEBRIDGE_CONFIG_UI_PORT=8080 -v $HOME/homebridge:/homebridge -v `pwd`:/usr/local/node_modules/homebridge-chuango-h4 oznu/homebridge:latest
