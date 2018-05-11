defmodule VisualixirWeb.NodesChannel do
  use Visualixir.Web, :channel
  alias VisualixirWeb.Endpoint
  alias Visualixir.Tracer
  require Logger

  @moduledoc """
  Channel for communicating node information to clients subscribed to updates.
  """

  @self Node.self |> Atom.to_string

  def join("nodes", _auth_msg, socket) do
    {:ok, nodes_msg(), socket}
  end

  def handle_in("add", a_node, socket) do
    ping_result = a_node |> String.to_atom |> Node.ping
    Logger.debug(fn -> "Pinging node #{a_node} returned #{inspect ping_result}." end)
    Endpoint.broadcast! "nodes", "update", nodes_msg()
    {:noreply, socket}
  end

  def handle_in("cleanup", a_node, socket) when a_node != @self do
    a_node |> String.to_atom |> Tracer.cleanup
    Logger.debug(fn -> "Telling node #{a_node} to clean up." end)
    {:noreply, socket}
  end
  def handle_in("cleanup", _node, socket), do: {:noreply, socket}

  defp nodes_msg do
    %{nodes: Node.list(:known)}
  end
end
