#!/usr/bin/env bash
# Skine kartu Hrvatske (OpenStreetMap, Geofabrik) i pripremi je za OSRM.
# Pokreće se jednom, i po želji povremeno (npr. jednom mjesečno) za svježe ulice.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data
IMG=ghcr.io/project-osrm/osrm-backend:v5.27.1

curl -fL -o data/croatia-latest.osm.pbf https://download.geofabrik.de/europe/croatia-latest.osm.pbf

docker run --rm -t -v "$PWD/data:/data" "$IMG" osrm-extract -p /opt/car.lua /data/croatia-latest.osm.pbf
docker run --rm -t -v "$PWD/data:/data" "$IMG" osrm-partition /data/croatia-latest.osrm
docker run --rm -t -v "$PWD/data:/data" "$IMG" osrm-customize /data/croatia-latest.osrm

echo "Gotovo. Pokreni: docker compose up -d"
