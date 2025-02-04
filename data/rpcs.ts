import { base, baseSepolia } from "viem/chains";

export const RPC_URL: {
  [chainId: number]: string;
} = {
  [baseSepolia.id]: "https://sepolia.base.org",
  [base.id]: "https://mainnet.base.org",
};
