import * as fcl from "@onflow/fcl";

const ADMIN_PRIVATE_KEY = "54011f6778ae2ccc9d0175212b225b116c37c1a94262fdcdc0369cf7ae69f723";
const ADMIN_ACCOUNT_ADDRESS = "0x6749ea8e0a268f1a"; // Your deployed contract address

// FCL Configuration
fcl.config()
  .put("accessNode.api", "https://rest-testnet.onflow.org")
  .put("discovery.wallet", "https://fcl-discovery.onflow.org/testnet/authn")
  .put("0xDelegationPool", ADMIN_ACCOUNT_ADDRESS)
  .put("0xFungibleToken", "0x9a0766d93b6608b7")
  .put("0xFlowToken", "0x7e60df042a9c0868")
  .put("adminPrivateKey", ADMIN_PRIVATE_KEY)
  .put("adminAddress", ADMIN_ACCOUNT_ADDRESS)