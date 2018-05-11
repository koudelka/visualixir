defmodule Visualixir.Mixfile do
  use Mix.Project

  def project do
    [
      app: :visualixir,
      version: "0.1.0",
      elixir: "~> 1.0",
      elixirc_paths: elixirc_paths(Mix.env()),
      elixirc_options: [warnings_as_errors: true],
      compilers: [:phoenix] ++ Mix.compilers(),
      build_embedded: Mix.env() == :prod,
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      test_coverage: [tool: ExCoveralls],
      preferred_cli_env: [
        "coveralls": :test,
        "coveralls.detail": :test,
        "coveralls.post": :test,
        "coveralls.html": :test,
      ],
    ]
  end

  # Configuration for the OTP application
  #
  # Type `mix help compile.app` for more information
  def application do
    [mod: {Visualixir, []},
     applications: [:phoenix, :phoenix_html, :cowboy, :logger]]
  end

  # Specifies which paths to compile per environment
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_),     do: ["lib"]

  # Specifies your project dependencies
  #
  # Type `mix help deps` for examples and options
  defp deps do
    [
      {:phoenix, "~> 1.3"},
      {:phoenix_html, "~> 2.11"},
      {:phoenix_live_reload, "~> 1.1", only: :dev},
      {:cowboy, "~> 1.0"},
      {:credo, "~> 0.9.1", only: [:dev, :test], runtime: false},
      {:excoveralls, "~> 0.8.2", only: :test, runtime: false},
      {:mix_test_watch, "~> 0.5", only: :dev, runtime: false},
    ]
  end
end
