#!/bin/bash
S="$(cd "$(dirname "$0")" && pwd)"
export NODE_PATH=$(npm root -g)
OUT=${OUT:-$S/results.ndjson}; : > $OUT
P=(small medium large)
for r in 0 1 2 3 4 5; do
  for k in 0 1 2; do
    prof=${P[$(( (r + k) % 3 ))]}
    if (( (r + k) % 2 )); then order="4301 4302"; else order="4302 4301"; fi
    for port in $order; do
      timeout 600 node $S/bench.cjs $port $prof 1 $OUT > /dev/null 2>> $S/series.err || echo "fail $port $prof $r" >> $S/series.err
    done
  done
done
echo SERIES_DONE
