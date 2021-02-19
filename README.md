# Kaminari-core (PoC)

Kaminari Core is a smart contract chain created using Lisk SDK as a proof of concept.

It is using [ewasm protocol](https://github.com/ewasm/design).

### Remarks

- Gas metering injection is not implemeted
- Only saple command is implemented
- Tx-pool and block will only look at payload size
- Query is not possible now.

### How to try executing the smart conract

1. Prepare a node

```
npm install
```

2. Run a node

```
./bin/run start -n devnet --api-ws --api-ws-port 8000 --console-log error
```

3. Execute deploy script

```
node sample/deploy.js
```

The deployed contract information will be displayed on the console.
Copy & replace the information in the execute script on top.

4. Execute execute script

```
node sample/exec.js
```

Observe the result bytes is returning 0 and 1 alternatively everytime exec is called.

### Try different script

```
make init
```

- Update `flopper.sol` in the sol folder

```
make wasm.build
```

- Deploy
- Execute (execute command input must be updated based on the change)
