defmodule Visualixir.Tracer do
  use GenServer
  alias VisualixirWeb.TraceChannel
  require Logger

  def start(node) do
    # visualixir node already has this module
    if node != Node.self() do
      send_module(node)
    end

    Node.spawn_link(node, :gen_server, :start, [{:local, __MODULE__}, __MODULE__, [Node.self], []])
  end

  def stop(node) do
    :ok = GenServer.stop({__MODULE__, node})
  end

  def initial_state(node) do
    :rpc.call(node, __MODULE__, :initial_state, [])
  end

  def msg_trace(pid) do
    if is_pid(pid) do
      GenServer.call({__MODULE__, node(pid)}, {:trace_msg, true, pid})
    else
      Logger.warn "#{inspect pid} on isn't a pid, can't trace it."
    end
  end

  def stop_msg_trace_all(node) do
    GenServer.call({__MODULE__, node}, :stop_trace_msg_all)
  end

  #
  # ------- Erlang Functions Only Zone -------
  #
  # Code below can't contain any Elixir-specific functions, since it should be able to run on
  # non-Elixir nodes. Sorry that this module is so gnarly, the :lists module loves to put the
  # list at the end of the arguments, so it doesn't look like nice Elixir. :(
  #
  # Maybe in the future, it can be refactored with a pipeline that does the second-argument sugar.
  # (or maybe just rpc remote nodes for data and do the collection wrangling on the local node)
  #

  def init([visualizer_node]) do
    :erlang.trace(:all, true, [:procs])
    :ok = :net_kernel.monitor_nodes(true)

    {:ok, visualizer_node}
  end

  def handle_call({:trace_msg, on_off, pid_spec}, _from, visualizer_node) do
    :erlang.trace(pid_spec, on_off, [:send, :receive])

    {:reply, :ok, visualizer_node}
  end

  def handle_call(:stop_trace_msg_all, _from, visualizer_node) do
    :lists.foreach(&:erlang.trace(&1, false, [:send, :receive]), :erlang.processes)

    {:reply, :ok, visualizer_node}
  end

  def handle_info({:trace, _spawner_pid, :spawn, pid, _mfa} = msg, visualizer_node) do
    :rpc.call(visualizer_node, TraceChannel, :announce_spawn, [map_pids_to_info([pid])])

    {:noreply, visualizer_node}
  end

  def handle_info({:trace, pid, :exit, _reason}, visualizer_node) do
    :rpc.call(visualizer_node, TraceChannel, :announce_exit, [pid])

    {:noreply, visualizer_node}
  end

  # if a pid has only one link now, it had zero before this event
  def handle_info({:trace, from_pid, :link, to_pid}, visualizer_node) do
    msg = %{from: from_pid,
            from_was_unlinked: length(links(from_pid)) == 1,
            to: to_pid,
            to_was_unlinked: length(links(to_pid)) == 1}
    :rpc.call(visualizer_node, TraceChannel, :announce_link, [msg])

    {:noreply, visualizer_node}
  end

  def handle_info({:trace, from_pid, :unlink, to_pid}, visualizer_node) do
    msg = %{from: from_pid,
            from_any_links: length(links(from_pid)) > 0,
            to: to_pid,
            to_any_links: length(links(to_pid)) > 0}
    :rpc.call(visualizer_node, TraceChannel, :announce_unlink, [msg])

    {:noreply, visualizer_node}
  end

  def handle_info({:trace, from_pid, :send, msg, to_pid}, visualizer_node) do
    :rpc.call(visualizer_node, TraceChannel, :announce_msg, [from_pid,
                                                             to_pid,
                                                             msg])
    {:noreply, visualizer_node}
  end

  def handle_info({:nodedown, visualizer_node}, visualizer_node) do
    :erlang.display('[Visualixir] Lost connection to visualizer node, purging Tracer module.')

    cleanup()

    {:stop, :normal, visualizer_node}
  end

  def handle_info(msg, state) do
    {:noreply, state}
  end


  def initial_state do
    %{pids: :lists.merge(:erlang.processes, :erlang.ports) |> map_pids_to_info}
  end

  def all_links do
    :lists.flatmap(fn pid ->
      links = case process_info(pid, :links) do
                {:links, links} -> links
                :undefined      -> []
              end

      :lists.map( &:lists.sort([pid, &1]), links )
    end, :erlang.processes)
    |> :lists.usort
  end

  defp pid_to_binary(pid) when is_pid(pid) do
    pid |> :erlang.pid_to_list |> :erlang.list_to_binary
  end

  defp pid_to_binary(port) when is_port(port) do
    port |> :erlang.port_to_list |> :erlang.list_to_binary
  end

  defp pid_name(pid) when is_pid(pid) do
    case process_info(pid, :registered_name) do
      {:registered_name, name} -> :erlang.atom_to_binary(name, :utf8)
      _ -> pid_to_binary(pid)
    end
  end

  defp pid_name(port) when is_port(port) do
    case :erlang.port_info(port, :name) do
      {:name, name} -> name |> :erlang.list_to_binary
      _ -> pid_to_binary(port)
    end
  end

  defp application(pid) when is_pid(pid) do
    case :application.get_application(pid) do
      :undefined -> nil
      {_pid, app} -> app
    end
  end
  defp application(port) when is_port(port), do: nil

  defp process_type(pid) when is_pid(pid) do
    case process_info(pid, :dictionary) do
      :undefined -> :dead
      {:dictionary, dictionary} ->
        case :lists.keyfind(:"$initial_call", 1, dictionary) do
          {_, {:supervisor, _, _}} -> :supervisor
          _ -> :normal
        end
      _ -> :normal
    end
  end
  defp process_type(port) when is_port(port), do: :port

  defp links(pid) when is_pid(pid) do
    case process_info(pid, :links) do
      {:links, links} -> links
      _ -> []
    end
  end

  defp links(port) when is_port(port) do
    case :erlang.port_info(port, :links) do
      {:links, links} -> links
      _ -> []
    end
  end

  defp process_being_msg_traced(pid) when is_pid(pid) do
    case :erlang.trace_info(pid, :flags) do
      {:flags, flags} -> :lists.member(:receive, flags) || :lists.member(:send, flags)
      _ -> false
    end
  end
  defp process_being_msg_traced(port) when is_port(port), do: false

  defp map_pids_to_info(pids) do
    pids = :lists.map(fn pid ->
      {pid, %{name: pid_name(pid),
              node: node(),
              type: process_type(pid),
              links: links(pid),
              application: application(pid),
              msg_traced: process_being_msg_traced(pid)}}
    end, pids)

    :lists.filter(fn {_pid, %{type: type}} -> type != :dead end, pids)
    |> :maps.from_list
  end

  defp process_info(pid, key) do
    try do
      :erlang.process_info(pid, key)
    rescue ArgumentError ->
        nil
    end
  end

  #
  # Remote node code (un)loading.
  #

  def send_module(node) do
    {module, binary, file} = :code.get_object_code(__MODULE__)
    :rpc.call(node, :code, :load_binary, [module, file, binary])
  end

  def cleanup do
    :code.purge(__MODULE__)
    :code.delete(__MODULE__)
  end
end
