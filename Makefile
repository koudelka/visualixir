
compile:
	mix compile

test:
	mix test

continuous_tests:
	mix test.watch

clean:
	mix clean

lint:
	mix credo --strict

.PHONY: compile test continuous_tests clean lint

