#
# This file lives in `lib` as it needs to be compiled for its binary module code to be sent over the wire
# You could also compile it manually, but this is less of a pain in the ass
#

defmodule Visualixir.Examples.MultiNodePingPong do

  alias Visualixir.Util

  @delay 1400
  @name :pinger

  def start do
    send_module_to_all_nodes()
    spawn_pingers()

    :ok
  end

  defp spawn_pingers do
    Node.list() ++ [List.first(Node.list())]
    |> spawn_pingers
  end

  defp spawn_pingers([]), do: :ok
  defp spawn_pingers([last]), do: send({@name, last}, {:nobody, :ping})

  defp spawn_pingers([node | [next | _rest] = rest]) do
    Node.spawn(node, fn ->
      # IO.puts "started on #{inspect node()}"
      pid = spawn(__MODULE__, :loop, [next])
      :erlang.register(@name, pid)
    end)

    spawn_pingers(rest)
  end


  def loop(next) do
    receive do
      {_from, incoming} ->
        # IO.puts "#{inspect node()}: msg #{inspect incoming} from #{inspect from}"
        outgoing =
          case incoming do
            :ping -> :pong
            :pong -> :ping
          end
        :timer.sleep(@delay)
        send({@name, next}, {self(), outgoing})
    end

    loop(next)
  end

  defp send_module_to_all_nodes do
    Enum.each(Node.list, &Util.send_module(__MODULE__, &1))
  end
end
