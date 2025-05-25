import * as fcl from '@onflow/fcl';
import { ec } from 'elliptic';
import * as hashjs from 'hash.js';

// Initialize crypto
const flowEC = new ec('secp256k1');

export interface FCLUser {
  addr: string;
  loggedIn: boolean;
}

// Admin configuration
const ADMIN_PRIVATE_KEY = "54011f6778ae2ccc9d0175212b225b116c37c1a94262fdcdc0369cf7ae69f723";
const ADMIN_ACCOUNT_ADDRESS = "0x6749ea8e0a268f1a";

const signWithKey = (privateKey: string, message: string) => {
    const messageHash = hashjs.sha256().update(message).digest();
    const key = flowEC.keyFromPrivate(Buffer.from(privateKey, 'hex'));
    return key.sign(messageHash).toDER('hex');
  };

// Configure FCL
fcl.config({
  'accessNode.api': 'https://rest-testnet.onflow.org',
  'discovery.wallet': 'https://fcl-discovery.onflow.org/testnet/authn',
  'app.detail.title': 'Flow Delegation Pool V2',
  'app.detail.icon': 'https://placekitten.com/g/200/200',
  '0xDelegationPoolV2': ADMIN_ACCOUNT_ADDRESS,
  '0xFungibleToken': '0x9a0766d93b6608b7',
  '0xFlowToken': '0x7e60df042a9c0868',
});

// Contract addresses
const CONTRACT_ADDRESSES = {
  DelegationPoolV2: ADMIN_ACCOUNT_ADDRESS,
  FlowToken: "0x7e60df042a9c0868",
  FungibleToken: "0x9a0766d93b6608b7"
};

// Transaction Templates
export const CREATE_DELEGATOR_TX = `
import DelegationPoolV2 from ${CONTRACT_ADDRESSES.DelegationPoolV2}

transaction {
    prepare(signer: auth(Storage, Capabilities) &Account) {
        // Check if delegator resource already exists
        if signer.storage.borrow<&DelegationPoolV2.Delegator>(from: DelegationPoolV2.DelegatorStoragePath) != nil {
            panic("Delegator resource already exists")
        }

        // Create and save delegator resource
        let delegator <- DelegationPoolV2.createDelegator()
        signer.storage.save(<-delegator, to: DelegationPoolV2.DelegatorStoragePath)
        
        // Create public capability
        let cap = signer.capabilities.storage.issue<&{DelegationPoolV2.DelegatorPublic}>(DelegationPoolV2.DelegatorStoragePath)
        signer.capabilities.publish(cap, at: DelegationPoolV2.DelegatorPublicPath)
        
        log("Delegator resource created successfully")
    }
}`;

export const DELEGATE_TOKENS_TX = `
import DelegationPoolV2 from ${CONTRACT_ADDRESSES.DelegationPoolV2}

transaction(amount: UFix64) {
    prepare(signer: auth(Storage, BorrowValue) &Account) {
        // Get reference to the pool
        let poolRef = getAccount(${CONTRACT_ADDRESSES.DelegationPoolV2})
            .capabilities.borrow<&{DelegationPoolV2.PoolPublic}>(DelegationPoolV2.PoolPublicPath)
            ?? panic("Could not borrow pool reference")

        // Delegate tokens
        poolRef.delegate(delegator: signer, amount: amount)
        
        log("Successfully delegated ".concat(amount.toString()).concat(" FLOW tokens"))
    }
}`;

export const CLAIM_REWARDS_TX = `
import DelegationPoolV2 from ${CONTRACT_ADDRESSES.DelegationPoolV2}
import FlowToken from ${CONTRACT_ADDRESSES.FlowToken}

transaction {
    prepare(signer: auth(Storage) &Account) {
        // Get reference to the pool
        let poolRef = getAccount(${CONTRACT_ADDRESSES.DelegationPoolV2})
            .capabilities.borrow<&{DelegationPoolV2.PoolPublic}>(DelegationPoolV2.PoolPublicPath)
            ?? panic("Could not borrow pool reference")

        // Claim rewards
        let rewards <- poolRef.claimRewards(delegator: signer.address)
        
        // Deposit rewards into user's main FLOW vault
        let vaultRef = signer.storage.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow FlowToken vault reference")
        
        let rewardAmount = rewards.balance
        vaultRef.deposit(from: <-rewards)
        
        log("Successfully claimed ".concat(rewardAmount.toString()).concat(" FLOW rewards"))
    }
}`;

export const ADD_REWARD_TOKENS_TX = `
import DelegationPoolV2 from ${CONTRACT_ADDRESSES.DelegationPoolV2}
import FlowToken from ${CONTRACT_ADDRESSES.FlowToken}
import FungibleToken from ${CONTRACT_ADDRESSES.FungibleToken}

transaction(amount: UFix64) {
    prepare(signer: auth(Storage, BorrowValue) &Account) {
        // Get reference to the pool
        let poolRef = getAccount(${CONTRACT_ADDRESSES.DelegationPoolV2})
            .capabilities.borrow<&{DelegationPoolV2.PoolPublic}>(DelegationPoolV2.PoolPublicPath)
            ?? panic("Could not borrow pool reference")

        // Get signer's FlowToken vault
        let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow FlowToken vault reference")

        // Withdraw tokens and add as rewards
        let tokens <- vaultRef.withdraw(amount: amount)
        poolRef.addRewardTokens(from: <-tokens)
        
        log("Successfully added ".concat(amount.toString()).concat(" FLOW as reward tokens"))
    }
}`;

// Script Templates
export const GET_DELEGATION_INFO_SCRIPT = `
import DelegationPoolV2 from ${CONTRACT_ADDRESSES.DelegationPoolV2}

access(all) fun main(address: Address): {String: AnyStruct} {
    let account = getAccount(address)
    
    // Check if delegator resource exists
    let delegatorRef = account.capabilities.borrow<&{DelegationPoolV2.DelegatorPublic}>(DelegationPoolV2.DelegatorPublicPath)
    
    if delegatorRef == nil {
        return {
            "hasResource": false,
            "balance": 0.0
        }
    }
    
    return {
        "hasResource": true,
        "balance": delegatorRef!.balance
    }
}`;

export const GET_POOL_INFO_SCRIPT = `
import DelegationPoolV2 from ${CONTRACT_ADDRESSES.DelegationPoolV2}

access(all) fun main(): {String: AnyStruct} {
    return {
        "totalDelegated": DelegationPoolV2.totalDelegated
    }
}`;

export const GET_FLOW_BALANCE_SCRIPT = `
import FlowToken from ${CONTRACT_ADDRESSES.FlowToken}
import FungibleToken from ${CONTRACT_ADDRESSES.FungibleToken}

access(all) fun main(address: Address): UFix64 {
    let account = getAccount(address)
    let vaultRef = account.capabilities.borrow<&{FungibleToken.Balance}>(/public/flowTokenBalance)
        ?? panic("Could not borrow Balance reference to the Vault")
    
    return vaultRef.balance
}`;

// Admin authorization function
const adminAuth = () => ({
    ...fcl.authz,
    addr: ADMIN_ACCOUNT_ADDRESS,
    keyId: 0,
    signingFunction: async (data: any) => ({
        addr: ADMIN_ACCOUNT_ADDRESS,
        keyId: 0,
        signature: signWithKey(ADMIN_PRIVATE_KEY, data.message),
    })
});

// Helper Functions
export const createDelegator = async () => {
    try {
        console.log('Creating delegator with user authorization...');
        
        const transactionId = await fcl.mutate({
            cadence: CREATE_DELEGATOR_TX,
            proposer: fcl.currentUser,
            payer: fcl.currentUser,
            authorizations: [fcl.currentUser],
            limit: 1000
        });
        
        console.log('Transaction ID:', transactionId);
        const result = await fcl.tx(transactionId).onceSealed();
        console.log('Transaction result:', result);
        return result;
    } catch (error) {
        console.error('Error in createDelegator:', error);
        throw error;
    }
};

export const delegateTokens = async (amount: number) => {
    try {
        console.log('Delegating tokens:', amount);
        
        const transactionId = await fcl.mutate({
            cadence: DELEGATE_TOKENS_TX,
            args: (arg: any, t: any) => [
                arg(amount.toFixed(8), t.UFix64)
            ],
            proposer: fcl.currentUser,
            payer: fcl.currentUser,
            authorizations: [fcl.currentUser],
            limit: 1000
        });
        
        console.log('Transaction ID:', transactionId);
        const result = await fcl.tx(transactionId).onceSealed();
        console.log('Transaction result:', result);
        return result;
    } catch (error) {
        console.error('Error in delegateTokens:', error);
        throw error;
    }
};

export const claimRewards = async () => {
    try {
        console.log('Claiming rewards...');
        
        const transactionId = await fcl.mutate({
            cadence: CLAIM_REWARDS_TX,
            proposer: fcl.currentUser,
            payer: fcl.currentUser,
            authorizations: [fcl.currentUser],
            limit: 1000
        });
        
        console.log('Transaction ID:', transactionId);
        const result = await fcl.tx(transactionId).onceSealed();
        console.log('Transaction result:', result);
        return result;
    } catch (error) {
        console.error('Error in claimRewards:', error);
        throw error;
    }
};

// Admin functions
export const addRewardTokens = async (amount: number) => {
    try {
      console.log('Adding reward tokens with admin auth...', amount);
      
      const transactionId = await fcl.mutate({
        cadence: ADD_REWARD_TOKENS_TX,
        args: (arg: any, t: any) => [
          arg(amount.toFixed(8), t.UFix64)
        ],
        proposer: adminAuth,
        payer: adminAuth,
        authorizations: [adminAuth],
        limit: 999
      });
  
      console.log('Transaction submitted:', transactionId);
      const result = await fcl.tx(transactionId).onceSealed();
      console.log('Transaction sealed:', result);
      return result;
    } catch (error) {
      console.error("Error adding reward tokens:", error);
      throw error;
    }
  };

export const getDelegationInfo = async (userAddress: string) => {
    try {
        console.log('Getting delegation info for:', userAddress);
        
        const result = await fcl.query({
            cadence: GET_DELEGATION_INFO_SCRIPT,
            args: (arg: any, t: any) => [
                arg(userAddress, t.Address)
            ]
        });
        
        console.log('Delegation info result:', result);
        return result;
    } catch (error) {
        console.error('Error in getDelegationInfo:', error);
        throw error;
    }
};

export const getPoolInfo = async () => {
    try {
        console.log('Getting pool info...');
        
        const result = await fcl.query({
            cadence: GET_POOL_INFO_SCRIPT
        });
        
        console.log('Pool info result:', result);
        return result;
    } catch (error) {
        console.error('Error in getPoolInfo:', error);
        throw error;
    }
};

export const getFlowBalance = async (address: string) => {
    try {
        console.log('Getting FLOW balance for:', address);
        
        const result = await fcl.query({
            cadence: GET_FLOW_BALANCE_SCRIPT,
            args: (arg: any, t: any) => [
                arg(address, t.Address)
            ]
        });
        
        console.log('FLOW balance result:', result);
        return result;
    } catch (error) {
        console.error('Error in getFlowBalance:', error);
        throw error;
    }
};

// Authentication helpers
export const authenticate = async () => {
    try {
        console.log('Authenticating user...');
        await fcl.authenticate();
        console.log('Authentication successful');
    } catch (error) {
        console.error('Authentication error:', error);
        throw error;
    }
};

export const unauthenticate = async () => {
    try {
        console.log('Unauthenticating user...');
        await fcl.unauthenticate();
        console.log('Unauthentication successful');
    } catch (error) {
        console.error('Unauthentication error:', error);
        throw error;
    }
};

export const getCurrentUser = async (): Promise<FCLUser | null> => {
    try {
        console.log('Getting current user...');
        const user = await fcl.currentUser.snapshot();
        console.log('Current user snapshot:', user);
        
        if (user?.addr) {
            return { addr: user.addr, loggedIn: true };
        }
        return null;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
};

// Check if user is admin
export const isAdminUser = (userAddress: string): boolean => {
    return userAddress === ADMIN_ACCOUNT_ADDRESS;
};