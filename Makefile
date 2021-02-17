# Makefile

init:
	docker pull hyperledgerlabs/solang

init.soll:
	docker pull secondstate/soll

wasm.build:
	docker run --rm -it -v $(shell pwd)/sol:/sources hyperledgerlabs/solang -v -o /sources --target ewasm /sources/${FILE}

wasm.build.substrate:
	docker run --rm -it -v $(shell pwd)/sol:/sources hyperledgerlabs/solang -v -o /sources --target substrate /sources/${FILE}

wasm.wat:
	/Users/shuse2/Documents/99_tmp/wabt/bin/wasm2wat ${FILE} -o ${OUTPUT}