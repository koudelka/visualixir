defmodule VisualixirWeb.PageControllerTest do
  use VisualixirWeb.ConnCase

  test "GET /" do
    conn = get build_conn(), "/"
    assert html_response(conn, 200) =~ "Visualixir"
  end
end
