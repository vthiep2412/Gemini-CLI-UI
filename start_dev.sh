#!/bin/bash
npm run dev > dev.log 2>&1 &
PID=$!
sleep 2

if kill -0 $PID 2>/dev/null; then
    echo $PID > dev.pid
    echo "Dev server started successfully with PID $PID"
else
    echo "Failed to start dev server. Check dev.log for details." >> dev.log
    rm -f dev.pid
    # Return 1 without exiting the shell since we run it in a shared session context sometimes
    return 1 2>/dev/null || true
fi
