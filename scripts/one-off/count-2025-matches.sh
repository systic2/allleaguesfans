#!/bin/bash

offset=1
total=0

echo "Counting 2025 K League 1 matches..."

for offset in {1..5}; do
  count=$(curl -s "https://sports.highlightly.net/football/matches?countryCode=KR&season=2025&leagueName=K%20League%201&offset=$offset" \
    -H "x-rapidapi-host: sport-highlights-api.p.rapidapi.com" \
    -H "x-rapidapi-key: 097fcd07-9a95-4b4d-8ff0-08db3a387d0a" | \
    python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('data', [])))")

  echo "Page $offset: $count matches"
  total=$((total + count))

  if [ "$count" -lt 100 ]; then
    break
  fi

  sleep 0.3
done

echo "Total: $total matches"
