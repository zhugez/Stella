#!/bin/bash
cd /home/dev/stella/tools/papago
BIN="./stella-trans"

run_range() {
  local session=$1
  shift
  for c in "$@"; do
    echo "[$session] Starting chunk $c..."
    $BIN -chunk $c -session $session | grep -E "Finished|finished|matched|Processing"
  done
}

run_range w1 31 32 33 34 35 > /tmp/w1.log 2>&1 &
PID1=$!
run_range w2 36 37 38 39 40 > /tmp/w2.log 2>&1 &
PID2=$!
run_range w3 41 42 43 44 45 > /tmp/w3.log 2>&1 &
PID3=$!
run_range w4 46 47 48 49 50 > /tmp/w4.log 2>&1 &
PID4=$!

echo "Launched 4 parallel workers: w1 (PID $PID1), w2 (PID $PID2), w3 (PID $PID3), w4 (PID $PID4)"
wait $PID1 $PID2 $PID3 $PID4
echo "=== ALL 4 THREADS FINISHED 20 CHUNKS (2,000 WORDS)! ==="
