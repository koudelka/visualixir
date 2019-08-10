for i in *.mov; do ffmpeg -i $i -vf "fps=10,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -c:v pam -f image2pipe - | convert -delay 5 - -loop 0 -layers optimizeplus $i.gif; don

gifsicle thing.mov.gif -O=5 -o new_thing.gif
