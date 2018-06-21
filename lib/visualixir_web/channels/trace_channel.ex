defmodule VisualixirWeb.TraceChannel do
  use Visualixir.Web, :channel
  alias Visualixir.Tracer
  alias VisualixirWeb.Endpoint
  alias Phoenix.Socket

  @channel "trace"

  def join(@channel, %{}, socket) do
    {:ok, nil, socket}
  end

  def handle_in("msg_trace", pid_str, socket) do
    pid_str |> pid_from_binary() |> Tracer.msg_trace

    {:noreply, socket}
  end

  def handle_in("stop_msg_trace_all", _msg, %Socket{topic: @channel} = socket) do
    :erlang.nodes(:known)
    |> Enum.each(&Tracer.stop_msg_trace_all/1)

    {:noreply, socket}
  end

  def announce_visualize(node) do
    broadcast!("visualize_node", initial_state(node))
  end

  def announce_cleanup(node) do
    broadcast!("cleanup_node", %{node: node})
  end

  def announce_spawn(pid_map) do
    broadcast!("spawn", pids_to_binaries(pid_map))
  end

  def announce_exit(pid) do
    broadcast!("exit", %{pid: pid_to_binary(pid)})
  end

  def announce_name(pid, name) do
    broadcast!("name", %{pid: pid_to_binary(pid), name: name})
  end

  def announce_link(%{from: from, to: to} = msg) do
    broadcast!("links", %{msg | from: pid_to_binary(from), to: pid_to_binary(to)})
  end

  def announce_unlink(%{from: from, to: to} = msg) do
    broadcast!("unlink", %{msg | from: pid_to_binary(from), to: pid_to_binary(to)})
  end

  def announce_msg(from_pid, to_pid, msg) do
    broadcast!("msg", %{from_pid: pid_to_binary(from_pid), to_pid: pid_to_binary(to_pid), msg: inspect(msg)})
  end

  def broadcast!(type, msg) do
    Endpoint.broadcast!(@channel, type, msg)
  end


  defp initial_state(node) do
    %{pids: pids} = Tracer.initial_state(node)

    %{pids: pids_to_binaries(pids)}
  end

  defp pids_to_binaries(map) do
    Enum.into(map, %{}, fn {pid, %{links: links} = info} ->
      {pid_to_binary(pid), %{info | links: Enum.map(links, &pid_to_binary/1)}}
    end)
  end

  defp pid_pairs_to_binary(pairs) do
    Enum.map(pairs, &pid_pair_to_binary/1)
  end

  defp pid_pair_to_binary([from, to]) do
    [pid_to_binary(from), pid_to_binary(to)]
  end


  defp pid_to_binary(pid) when is_pid(pid) do
    pid
    |> :erlang.pid_to_list
    |> :erlang.list_to_binary
  end

  defp pid_to_binary(port) when is_port(port) do
    port
    |> :erlang.port_to_list
    |> :erlang.list_to_binary
  end

  def pid_from_binary("<" <> _pidstr = binary) do
    binary
    |> :erlang.binary_to_list
    |> :erlang.list_to_pid
  end

  def pid_from_binary(binary) do
    binary
    |> :erlang.binary_to_list
    |> :erlang.list_to_atom
    |> :erlang.whereis
  end

end
