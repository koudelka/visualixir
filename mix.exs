defmodule Visualixir.Mixfile do
  use Mix.Project

  def project do
    [
      app: :visualixir,
      version: "0.1.99999999",
      elixir: "~> 1.5",
      elixirc_paths: elixirc_paths(),
      # elixirc_options: [warnings_as_errors: true],
      compilers: [:phoenix] ++ Mix.compilers(),
      build_embedded: Mix.env() == :prod,
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  defp elixirc_paths, do: ["lib", "test/support"]

  # Configuration for the OTP application
  #
  # Type `mix help compile.app` for more information
  def application do
    [mod: {Visualixir, []},
     applications: [:phoenix, :phoenix_html, :cowboy, :logger]]
  end

  # Specifies your project dependencies
  #
  # Type `mix help deps` for examples and options
  defp deps do
    [
      {:phoenix, "~> 1.3"},
      {:phoenix_html, "~> 2.11"},
      {:phoenix_live_reload, "~> 1.1", only: :dev},
      {:cowboy, "~> 1.0"}
    ]
  end
end
