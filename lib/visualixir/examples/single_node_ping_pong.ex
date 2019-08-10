#
# This file lives in `lib` as it needs to be compiled for its binary module code to be sent over the wire
#
# You could also compile it manually, but this is less of a pain in the ass
#

defmodule Visualixir.Examples.SingleNodePingPong do

  alias Visualixir.Util

  @delay 1400


  def start(node) do
    Util.send_module(__MODULE__, node)
    Node.spawn(node, &start/0)
  end

  def start do
    pinger = spawn(__MODULE__, :loop, [])
    ponger = spawn(__MODULE__, :loop, [])

    Process.register(pinger, :local_pinger)
    Process.register(ponger, :local_ponger)

    send(ponger, {pinger, :ping})

    {pinger, ponger}
  end

  def loop do
    receive do
      {from, :ping} ->
        :timer.sleep(@delay)
        send(from, {self(), :pong})
      {from, :pong} ->
        :timer.sleep(@delay)
        send(from, {self(), :ping})
    end

    loop()
  end
end
