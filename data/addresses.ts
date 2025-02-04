import { base, baseSepolia } from "viem/chains";
import { Addresses } from "../types";

export const PoolManagerAddress: Addresses = {
  [baseSepolia.id]: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
  [base.id]: "0x498581fF718922c3f8e6A244956aF099B2652b2b",
};

export const BidWallAddress: Addresses = {
  [baseSepolia.id]: "0xF077b0298c3e4348e80E8C7e19C991CD6dD8bd59",
  [base.id]: "0x66681f10BA90496241A25e33380004f30Dfd8aa8",
};

export const FairLaunchAddress: Addresses = {
  [baseSepolia.id]: "0x11A7F055DF05626cC6a1671161A4c51e4eb3B219",
  [base.id]: "0xCc7A4A00072ccbeEEbd999edc812C0ce498Fb63B",
};
