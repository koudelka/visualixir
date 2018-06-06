defmodule Visualixir.Support.Cluster do
  require Logger

  @starting_port 8500

  def spawn_cluster(num) do
    maybe_init()

    1..num
    |> Enum.map(fn _ ->
      Agent.get_and_update(__MODULE__, fn i -> {i, i + 1} end)
    end)
    |> Enum.map(&Task.async(fn -> spawn_node(&1) end))
    |> Enum.map(&Task.await(&1, 30_000))
    |> Enum.map(fn {:ok, node} -> node end)
    |> interconnect_cluster
    # |> wait_until_ready
  end

  defp maybe_init do
    fn -> @starting_port end
    |> Agent.start_link(name: __MODULE__) # port counter
    |> case do
         {:ok, _pid} ->
           Node.start(:"primary@127.0.0.1")
           :erl_boot_server.start([:"127.0.0.1"])
         {:error, {:already_started, _pid}} ->
           :ok
       end
  end

  defp spawn_node(port) do
    {:ok, node} = :slave.start('127.0.0.1', '#{port}', inet_loader_args())
    add_code_paths(node)
    # transfer_configuration(node, port)
    ensure_applications_started(node)
    {:ok, node}
  end

  defp rpc(node, module, function, args) do
    :rpc.block_call(node, module, function, args)
  end

  defp inet_loader_args do
    '-loader inet -hosts 127.0.0.1 -setcookie #{:erlang.get_cookie()}'
  end

  defp add_code_paths(node) do
    rpc(node, :code, :add_paths, [:code.get_path()])
  end

  defp transfer_configuration(node, port) do
    Application.loaded_applications
    |> Enum.map(fn {app_name, _, _} -> app_name end)
    |> Enum.map(fn app_name -> {app_name, Application.get_all_env(app_name)} end)
    |> Keyword.merge(additional_configs(port))
    |> Enum.each(fn {app_name, env} ->
      Enum.each(env, fn {key, val} ->
        :ok = rpc(node, :application, :set_env, [app_name, key, val, [persistent: true]])
      end)
    end)
  end

  defp ensure_applications_started(node) do
    ensure_application_started(node, :elixir)
    # ensure_application_started(node, :mix)
    # rpc(node, Mix, :env, [Mix.env])

    # for {app_name, _, _} <- Application.started_applications do
    #   ensure_application_started(node, app_name)
    # end

    # ensure_application_started(node, :riak_core)
    # ensure_application_started(node, :disorder)
  end

  defp ensure_application_started(node, application) do
    {:ok, _} = rpc(node, Application, :ensure_all_started, [application])
  end

  def additional_configs(port) do
    [disorder: [backend: Disorder.Backends.Memory],
     # i don't really know what this is for, the directories are always empty
     setup: [log_dir: "#{test_cluster_data_dir()}/log.#{port}",
             data_dir: "#{test_cluster_data_dir()}/var/data.#{port}"],
     riak_core: [
       node: 'disorder_#{port}@127.0.0.1',
       handoff_ip: '127.0.0.1',
       handoff_port: port,
       web_port: 8198, # unused?
       schema_dirs: ['priv'],
       ring_state_dir: '#{test_cluster_data_dir()}/ring_data_dir_#{port}',
       platform_data_dir: '#{test_cluster_data_dir()}/data_#{port}',
       platform_bin_dir: '#{test_cluster_data_dir()}/bin_#{port}'],
     sasl: [errlog_type: :error],
     logger: [console: [level: :error]],
     lager: [handlers: [lager_console_backend: :error]]
    ]
  end

  def interconnect_cluster(nodes) do
    Enum.each(nodes, &rpc(&1, Disorder.RiakCore, :join, [node()]))
    nodes
  end

  def test_cluster_data_dir do
    "var/test"
  end

  # def wait_until_ready(nodes) do
  #   Enum.each(nodes, fn node ->
  #     GenServer.call({Disorder.Checkpointer, node}, :last_checkpoint) |> IO.inspect
  #     # rpc(node, Disorder.RiakCore, :ring, []) |> IO.puts
  #     # rpc(node, :riak_core_console, :member_status, [[]]) |> IO.inspect
  #     # rpc(node, :riak_core_status, :transfers, []) |> IO.inspect
  #     case rpc(node, :riak_core_ring_manager, :is_stable_ring, []) do
  #       false ->
  #         Process.sleep(1_000)
  #         wait_until_ready([node])
  #       true ->
  #         :ok
  #     end
  #   end)
  # end
end
