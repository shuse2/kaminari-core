pragma solidity >=0.0.0;

contract flipper {
	bool value;
	uint64 counter;

	/// Constructor that initializes the `bool` value to the given `init_value`.
	constructor() {
		value = false;
		counter = 1;
	}

	/// A message that can be called on instantiated contracts.
	/// This one flips the value of the stored `bool` from `true`
	/// to `false` and vice versa.
	function flip() public {
		value = !value;
		counter += 1;
	}

	/// Simply returns the current value of our `bool`.
	function get() public view returns (bool) {
		return value;
	}

	/// Simply returns the current value of our `bool`.
	function getCounter() public view returns (int) {
		return counter;
	}
}
