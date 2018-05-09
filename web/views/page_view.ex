defmodule Visualixir.PageView do
  use Visualixir.Web, :view

  def hostname do
    node() |> Atom.to_string |> String.split("@") |> List.last
  end
end
