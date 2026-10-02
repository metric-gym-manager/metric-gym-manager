#!/usr/bin/env bash
# Verify a rendered film: stream summary + audio peak per second (silences show as 0.00).
set -euo pipefail
cd "$(dirname "$0")/.."
D=node_modules/@remotion/compositor-linux-x64-gnu
export LD_LIBRARY_PATH=$D
"$D/ffprobe" -v error -show_entries stream=codec_type,width,height,r_frame_rate,nb_frames:format=duration -of compact "$1"
tmp=$(mktemp --suffix=.wav)
"$D/ffmpeg" -v error -y -i "$1" -vn -ac 1 -ar 8000 -c:a pcm_s16le "$tmp"
node -e "
const f=require('fs').readFileSync('$tmp');const b=f.subarray(f.indexOf('data')+8);const n=b.length/2;let s='';
for(let w=0;w*8000<n;w++){let p=0;for(let i=w*8000;i<Math.min(n,(w+1)*8000);i++)p=Math.max(p,Math.abs(b.readInt16LE(i*2)));s+=w+'s:'+(p/32768).toFixed(2)+' ';}console.log(s)"
rm -f "$tmp"
