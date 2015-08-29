defmodule Visualixir.PageController do
  use Visualixir.Web, :controller

  def index(conn, _params) do
    render conn, "index.html"
  end
end
