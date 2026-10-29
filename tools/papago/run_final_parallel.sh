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

run_range w1 51 52 53 54 55 56 > /tmp/fw1.log 2>&1 &
PID1=$!
run_range w2 57 58 59 60 61 62 > /tmp/fw2.log 2>&1 &
PID2=$!
run_range w3 63 64 65 66 67 > /tmp/fw3.log 2>&1 &
PID3=$!
run_range w4 68 69 70 71 72 > /tmp/fw4.log 2>&1 &
PID4=$!

echo "Launched final 4 parallel workers: w1 (PID $PID1), w2 (PID $PID2), w3 (PID $PID3), w4 (PID $PID4)"
wait $PID1 $PID2 $PID3 $PID4
echo "=== ALL REMAINING CHUNKS (51-72) FINISHED! ==="
