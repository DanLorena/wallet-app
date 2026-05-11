import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
  "https://sepolia.infura.io/v3/1f032a5db14d44d2a06c3dbb02cc13ff"
);

export function createWallet() {
  const wallet = ethers.Wallet.createRandom();

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic.phrase
  };
}

export function importWallet(privateKey) {
  const wallet = new ethers.Wallet(privateKey);

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    name: "Imported Wallet",
    owner: "Unknown owner",
    description: "Wallet imported using private key",
    network: "Sepolia Testnet",
    type: "Imported Wallet",
    createdAt: new Date().toLocaleString()
  };
}

export function restoreWalletFromMnemonic(mnemonic) {
  const wallet = ethers.Wallet.fromPhrase(mnemonic);

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: mnemonic,
    name: "Restored Wallet",
    owner: "Unknown owner",
    description: "Wallet restored using mnemonic phrase",
    network: "Sepolia Testnet",
    type: "Restored Wallet",
    createdAt: new Date().toLocaleString()
  };
}

export async function encryptWallet(privateKey, password) {
  const wallet = new ethers.Wallet(privateKey);
  const encryptedJson = await wallet.encrypt(password);

  return encryptedJson;
}

export async function decryptWallet(encryptedJson, password) {
  const wallet = await ethers.Wallet.fromEncryptedJson(
    encryptedJson,
    password
  );

  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
}

export async function getBalance(address) {
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

export async function sendTransaction(privateKey, to, amount) {
  const wallet = new ethers.Wallet(privateKey, provider);

  const tx = await wallet.sendTransaction({
    to,
    value: ethers.parseEther(amount)
  });

  return tx.hash;
}

export function isValidAddress(address) {
  return ethers.isAddress(address);
}