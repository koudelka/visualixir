defmodule Visualixir.Tracer do
  use GenServer
  alias Visualixir.TraceChannel
  require Logger

  def start(node) do
    Node.spawn_link(node, :gen_server, :start, [{:local, __MODULE__}, __MODULE__, [Node.self], []])
  end

  def initial_state(node) do
    :rpc.call(node, __MODULE__, :initial_state, [])
  end

  def msg_trace(node, pid_str) do
    pid = :rpc.call(node, __MODULE__, :pid_from_string, [pid_str])
    if is_pid(pid) do
      GenServer.call({__MODULE__, node}, {:trace_msg, true, pid})
    else
      Logger.warn "#{pid_str} on #{node} isn't a pid, can't trace it."
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

  def handle_info({:trace, _spawner_pid, :spawn, pid, _mfa}, visualizer_node) do
    :rpc.call(visualizer_node, TraceChannel, :announce_spawn, [:erlang.node, map_pids_to_info([pid])])

    {:noreply, visualizer_node}
  end

  def handle_info({:trace, pid, :exit, _reason}, visualizer_node) do
    :rpc.call(visualizer_node, TraceChannel, :announce_exit, [:erlang.node, pid_to_binary(pid)])

    {:noreply, visualizer_node}
  end

  def handle_info({:trace, from_pid, :link, to_pid}, visualizer_node) do
    link = :lists.map(&pid_to_binary/1, [from_pid, to_pid]) |> :lists.sort
    :rpc.call(visualizer_node, TraceChannel, :announce_link, [:erlang.node, link])

    {:noreply, visualizer_node}
  end

  # ignore ports, the gui knows when to unlink them
  def handle_info({:trace, from_pid, :unlink, to_pid}, visualizer_node) when is_pid(to_pid) do
    link = :lists.map(&pid_to_binary/1, [from_pid, to_pid]) |> :lists.sort
    :rpc.call(visualizer_node, TraceChannel, :announce_unlink, [:erlang.node, link])

    {:noreply, visualizer_node}
  end

  def handle_info({:trace, from_pid, :send, msg, to_pid}, visualizer_node) do
    :rpc.call(visualizer_node, TraceChannel, :announce_msg, [:erlang.node,
                                                             pid_to_binary(from_pid),
                                                             pid_to_binary(to_pid),
                                                             msg])
    {:noreply, visualizer_node}
  end

  def handle_info(_msg, state) do
    {:noreply, state}
  end


  def initial_state do
    %{
      pids: map_pids_to_info(:erlang.processes),
      ports: map_pids_to_info(:erlang.ports),
      links: all_links()
    }
  end

  def all_links do
    :lists.flatmap(fn pid ->
      links = case :erlang.process_info(pid, :links) do
                {:links, links} -> links
                :undefined      -> []
              end

      :lists.map( &:lists.sort([pid_to_binary(pid), pid_to_binary(&1)]), links )
    end, :erlang.processes)
    |> :lists.usort
  end


  defp pid_to_binary(pid) when is_pid(pid) do
    "#PID" <> (pid |> :erlang.pid_to_list |> :erlang.list_to_binary)
  end

  defp pid_to_binary(port) when is_port(port) do
    port |> :erlang.port_to_list |> :erlang.list_to_binary
  end

  # the msg tracer seems to give us back the registered name
  defp pid_to_binary(atom) when is_atom(atom) do
    atom |> :erlang.whereis |> pid_to_binary
  end

  defp pid_name(pid) when is_pid(pid) do
    case :erlang.process_info(pid, :registered_name) do
      {:registered_name, name} -> name |> :erlang.atom_to_binary(:utf8)
      _                        -> nil
    end
  end

  defp pid_name(port) when is_port(port) do
    case :erlang.port_info(port, :name) do
      {:name, name} -> name |> :erlang.list_to_binary
      _             -> nil
    end
  end

  defp application(pid) when is_pid(pid) do
    case :application.get_application(pid) do
      :undefined -> nil
      {_pid, app} -> app
    end
  end

  defp application(port) when is_port(port) do
    nil
  end

  defp process_type(pid) when is_pid(pid) do
    case :erlang.process_info(pid, :dictionary) do
      :undefined -> :dead
      {_, [{_, _}, "$initial_call": {:supervisor, _, _}]} -> :supervisor
      _ -> :normal
    end
  end
  defp process_type(port) when is_port(port), do: :port

  defp process_being_msg_traced(pid) when is_pid(pid) do
    case :erlang.trace_info(pid, :flags) do
      {:flags, flags} -> :lists.member(:receive, flags) || :lists.member(:send, flags)
      _ -> false
    end
  end

  defp process_being_msg_traced(port) when is_port(port), do: false

  defp map_pids_to_info(pids) do
    pids = :lists.map(fn pid ->
      {pid_to_binary(pid), %{name: pid_name(pid),
                             type: process_type(pid),
                             application: application(pid),
                             msg_traced: process_being_msg_traced(pid)}}
    end, pids)

    :lists.filter(fn {_pid, %{type: type}} -> type != :dead end, pids)
    |> :maps.from_list
  end

  def pid_from_string("#PID" <> string) do
    string
    |> :erlang.binary_to_list
    |> :erlang.list_to_pid
  end

  def pid_from_string(string) do
    string
    |> :erlang.binary_to_list
    |> :erlang.list_to_atom
    |> :erlang.whereis
  end

  #
  # Remote node code (un)loading.
  #

  def send_module(node) do
    {module, binary, file} = :code.get_object_code(__MODULE__)
    :rpc.call(node, :code, :load_binary, [module, file, binary])
  end

  def cleanup(node) do
    :rpc.call(node, :code, :delete, [__MODULE__])
    :rpc.call(node, :code, :purge, [__MODULE__])
  end
end
