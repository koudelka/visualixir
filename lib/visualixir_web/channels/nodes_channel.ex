defmodule VisualixirWeb.NodesChannel do
  use Visualixir.Web, :channel
  require Logger
  alias VisualixirWeb.Endpoint
  alias VisualixirWeb.TraceChannel
  alias Visualixir.Tracer

  @channel "nodes"

  def join(@channel, _auth_msg, socket) do
    {:ok, nodes_msg(), socket}
  end

  def refresh do
    Endpoint.broadcast!(@channel, "update", nodes_msg())
  end

  def handle_in("add", node, socket) do
    ping_result = node |> String.to_atom |> Node.ping
    Logger.debug("[Visualixir] Pinging node #{node} returned #{inspect ping_result}")

    refresh()

    {:noreply, socket}
  end

  def handle_in("visualize", node, socket) do
    node = String.to_atom(node)

    Tracer.start(node)

    TraceChannel.announce_visualize(node)

    {:noreply, socket}
  end

  def handle_in("cleanup", node, socket) do
    node = String.to_atom(node)

    Logger.debug("[Visualixir] Telling node #{node} to clean up")

    Tracer.stop(node)

    TraceChannel.announce_cleanup(node)

    {:noreply, socket}
  end

  defp nodes_msg do
    %{nodes: Node.list(:known)}
  end
end
