import { StateStore, codec, cryptography } from 'lisk-sdk';
import { ContractAccount, contractAccountSchema } from './schema';

export const SMART_CONTRACT_KEY = 'sc';

const getSmartContractAccountKey = (address: Buffer) =>
	`${SMART_CONTRACT_KEY}:${address.toString('binary')}:a`;

const getSmartContractValueKey = (address: Buffer, key: Buffer) =>
	`${SMART_CONTRACT_KEY}:${address.toString('binary')}:v:${key.toString('binary')}`;

export const getContractAddress = (caller: Buffer, nonce: bigint): Buffer => {
	const nonceBuffer = Buffer.alloc(8);
	nonceBuffer.writeBigUInt64LE(nonce);
	return cryptography.hash(Buffer.concat([caller, nonceBuffer])).slice(0, 20);
};

export const getContract = async (stateStore: StateStore, address: Buffer): Promise<ContractAccount> => {
	const encodedContractAccount = await stateStore.chain.get(getSmartContractAccountKey(address));
	if (!encodedContractAccount) {
		throw new Error(`Contract with address ${address.toString('hex')} not found.`);
	}
	const decodedContractAccount = codec.decode<ContractAccount>(contractAccountSchema, encodedContractAccount);
	return {
		...decodedContractAccount,
		address,
	};
};

const getCallerNonce = async (stateStore: StateStore, origin: Buffer, originNonce: bigint, caller: Buffer): Promise<bigint> => {
	if (origin.equals(caller)) {
		return originNonce;
	}
	const contract = await getContract(stateStore, caller);
	return contract.nonce;
};

export const createContract = async (stateStore: StateStore, origin: Buffer, originNonce: bigint, caller: Buffer, value: bigint, data: Buffer): Promise<ContractAccount> => {
	const nonce = await getCallerNonce(stateStore, origin, originNonce, caller);
	const address = getContractAddress(caller, nonce);
	const contract: ContractAccount = {
		address,
		code: data,
		value,
		nonce: BigInt(0),
		destructed: false,
	};
	const encodedContract = codec.encode(contractAccountSchema, contract);
	await stateStore.chain.set(getSmartContractAccountKey(contract.address), encodedContract);
	return contract;
};

export const updateContractValue = async (stateStore: StateStore, address: Buffer, value: bigint): Promise<void> => {
	const contract = await getContract(stateStore, address);
	contract.value += value;
	if (contract.value < BigInt(0)) {
		throw new Error(`${address.toString('hex')} value cannot be negative`);
	}
	const encodedContract = codec.encode(contractAccountSchema, contract);
	return stateStore.chain.set(getSmartContractAccountKey(address), encodedContract);
};

export const destructContract = async (stateStore: StateStore, address: Buffer): Promise<void> => {
	const contract = await getContract(stateStore, address);
	contract.destructed = true;
	const encodedContract = codec.encode(contractAccountSchema, contract);
	return stateStore.chain.set(getSmartContractAccountKey(address), encodedContract);
};

export const getContractValue = async (stateStore: StateStore, address: Buffer, key: Buffer): Promise<Buffer | undefined> =>
	stateStore.chain.get(getSmartContractValueKey(address, key));

export const setContractValue = async (stateStore: StateStore, address: Buffer, key: Buffer, value: Buffer): Promise<void> => {
	await stateStore.chain.set(getSmartContractValueKey(address, key), value);
};
