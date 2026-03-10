export const CONTRACT_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "bytes32", name: "usernameHash", type: "bytes32" },
      { indexed: false, internalType: "string",  name: "role",         type: "string"  },
      { indexed: false, internalType: "uint256", name: "timestamp",    type: "uint256" },
    ],
    name: "UserRegistered",
    type: "event",
  },
  {
    inputs: [
      { internalType: "string", name: "_username", type: "string" },
      { internalType: "string", name: "_role",     type: "string" },
    ],
    name: "getUserInfo",
    outputs: [
      { internalType: "string",  name: "", type: "string"  },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string",  name: "_username",     type: "string"  },
      { internalType: "string",  name: "_role",         type: "string"  },
      { internalType: "bytes32", name: "_passwordHash", type: "bytes32" },
    ],
    name: "registerUser",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_username", type: "string" },
      { internalType: "string", name: "_role",     type: "string" },
    ],
    name: "userExists",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string",  name: "_username",     type: "string"  },
      { internalType: "string",  name: "_role",         type: "string"  },
      { internalType: "bytes32", name: "_passwordHash", type: "bytes32" },
    ],
    name: "validateLogin",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];
