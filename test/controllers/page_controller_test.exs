defmodule VisualixirWeb.PageControllerTest do
  use VisualixirWeb.ConnCase

  test "GET /" do
    conn = get conn(), "/"
    assert html_response(conn, 200) =~ "Visualixir"
  end
end
