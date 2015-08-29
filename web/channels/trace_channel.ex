defmodule Visualixir.TraceChannel do
  use Visualixir.Web, :channel
  alias Visualixir.Tracer
  alias Visualixir.Endpoint
  alias Phoenix.Socket

  def join("trace:" <> node, _auth_msg, socket) do
    node = String.to_atom(node)
    Tracer.send_module(node)
    Tracer.start(node)

    {:ok, Tracer.initial_state(node), socket}
  end

  def handle_in("msg_trace", pid, %Socket{topic: "trace:" <> node} = socket) do
    node |> String.to_atom |> Tracer.msg_trace(pid)

    {:noreply, socket}
  end

  def handle_in("stop_msg_trace_all", _msg, %Socket{topic: "trace:" <> node} = socket) do
    node |> String.to_atom |> Tracer.stop_msg_trace_all

    {:noreply, socket}
  end

  def handle_in("cleanup", node, socket), do: {:noreply, socket}

  def announce_spawn(node, pid_map) do
    Endpoint.broadcast! "trace:#{node}", "spawn", pid_map
  end

  def announce_exit(node, pid) do
    Endpoint.broadcast! "trace:#{node}", "exit", %{pid: pid}
  end

  def announce_name(node, pid, name) do
    Endpoint.broadcast! "trace:#{node}", "name", %{pid: pid, name: name}
  end

  # a list of links is a list of lists
  # [[pid1, pid2], [pid3, pid4], ...]
  def announce_links(node, links) do
    Endpoint.broadcast! "trace:#{node}", "links", %{links: links}
  end

  def announce_link(node, link), do: announce_links(node, [link])

  def announce_unlink(node, link) do
    Endpoint.broadcast! "trace:#{node}", "unlink", %{link: link}
  end

  def announce_msg(node, from_pid, to_pid, msg) do
    Endpoint.broadcast! "trace:#{node}", "msg", %{from_pid: from_pid,
                                                  to_pid: to_pid,
                                                  msg: inspect(msg)}
  end
end
