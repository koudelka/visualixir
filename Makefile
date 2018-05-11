
compile:
	mix compile

test:
	mix test

clean:
	mix clean

lint:
	mix credo --strict

.PHONY: compile test clean lint

