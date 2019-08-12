#
# Note, in order to use this module, you'll need to start Visualixir in fully-qualified name mode, with 127.0.0.1 as the hostname.
#
# ex: iex --name visualixir@127.0.0.1 -S mix phx.server
#
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
  end

  defp maybe_init do
    fn -> @starting_port end
    |> Agent.start_link(name: __MODULE__) # port counter
    |> case do
         {:ok, _pid} ->
           :erl_boot_server.start([:"127.0.0.1"])
         {:error, {:already_started, _pid}} ->
           :ok
       end
  end

  defp spawn_node(port) do
    {:ok, node} = :slave.start('127.0.0.1', '#{port}', inet_loader_args())
    add_code_paths(node)
    ensure_applications_started(node)
    {:ok, node}
  end

  defp inet_loader_args do
    '-loader inet -hosts 127.0.0.1 -setcookie #{:erlang.get_cookie()}'
  end

  defp add_code_paths(node) do
    rpc(node, :code, :add_paths, [:code.get_path()])
  end

  defp ensure_applications_started(node) do
    ensure_application_started(node, :elixir)
  end

  defp ensure_application_started(node, application) do
    {:ok, _} = rpc(node, Application, :ensure_all_started, [application])
  end

  defp rpc(node, module, function, args) do
    :rpc.block_call(node, module, function, args)
  end
end
