defmodule PingPong do

  @delay 1000

  def start do
    pinger = spawn(__MODULE__, :loop, [])
    ponger = spawn(__MODULE__, :loop, [])

    send(ponger, {pinger, :ping})

    {pinger, ponger}
  end

  def loop do
    receive do
      {from, :ping} ->
        :timer.sleep(@delay)
        send(from, {self, :pong})
      {from, :pong} ->
        :timer.sleep(@delay)
        send(from, {self, :ping})
    end
    loop
  end
end
