# Visualixir

Visualixir is a toy process visualizer for remote BEAM nodes, written in Phoenix/Elixir/d3.

It's largely intended as a teaching tool, to give newer BEAM programmers a look into the process ecosystem living inside their nodes. However, it may prove of some amusement/use to more experienced folks (it's kinda neat to trace `iex` and the io system).

A huge gif is worth a thousand words:

![Demo Image](https://raw.githubusercontent.com/koudelka/visualixir/master/doc/demo.gif)

Here's Visualixir tracing some messages through the [Riemann](https://github.com/koudelka/elixir-riemann) application.
![Riemann Demo Image](https://raw.githubusercontent.com/koudelka/visualixir/master/doc/riemann.gif)


## Getting Going

1. Clone this repository.
2. Compile: `mix deps.get && mix compile && npm install`
3. Start 'er up: `elixir --sname visualixir --hidden -S mix phoenix.server`
4. Navigate to [the GUI](http://localhost:4000)

If you want to visualize other BEAM nodes, you'll need to start them up with the `--sname <unique_name_here>` option.

I suggest you use Chrome for Visualixir, Safari's SVG performance seems to be lacking.

There's a simple `PingPong` [module](https://github.com/koudelka/visualixir/blob/master/doc/ping_pong.ex) included, for demo purposes.

## Usage

#### Selecting Nodes
On the upper left of the terrible GUI is a list of nodes that Visualixir curently knows about, including itself. You can click on a node's name to visualize it, or you can add a new node by entering it in the text box.

#### Moving Around
Drag the background to pan around.

Move processes around and pin them down by dragging and dropping. To un-pin, double click.

Zoom by scrolling (mousewheel or two-finger swipe).

#### Message Tracing
Option-clicking (alt-clicking), will start message tracing the selected process. Its outline will change to red to remind you that you're tracing it. You can click the `Stop Msg Tracing` button to halt all message tracing.

#### Event Log
The log at the bottom keeps a brief history of a limited set of events on the node: spawns, exits, links, messages, etc..

## Warning
Do not run Visualixir on production nodes, seriously. I've tried to make it somewhat safe, but I suspect you can get into some bad message-tracing scenarios that'll compromise your node.

## Future plans
I think Visualixir is a decent starting place for other BEAM visualization tools. I'd love to see what folks come up with, PR's are gladly accepted! 💕 (the GUI needs a lot of love)

#### Riak
It'd be really cool to watch Riak through Visualixir, but I'm afraid that isn't possible right now. Riak ships with a custom BEAM version that's rather old. Visualixir needs BEAM version parity between itself and the node being visualized. If you can find a decent way around this, I'd love to hear it. :)
