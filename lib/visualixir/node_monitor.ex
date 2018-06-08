defmodule Visualixir.NodeMonitor do
  use GenServer
  require Logger

  def start_link do
    GenServer.start_link(__MODULE__, [])
  end

  def init([]) do
    :ok = :net_kernel.monitor_nodes(true)

    {:ok, nil}
  end

  def handle_info({:nodeup, node}, state) do
    Logger.info "[Visualixir] Connection to #{node} established."

    VisualixirWeb.NodesChannel.refresh()

    {:noreply, state}
  end

  def handle_info({:nodedown, node}, state) do
    Logger.warn "[Visualixir] Lost connection to #{node}..."

    VisualixirWeb.NodesChannel.refresh()

    {:noreply, state}
  end
end
