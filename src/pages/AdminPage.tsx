import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import * as fcl from '@onflow/fcl';
import { addRewardTokens, getPoolInfo, isAdminUser } from '../config/flow';
import './AdminPage.css';

const ADMIN_ACCOUNT_ADDRESS = "0x6749ea8e0a268f1a";

function AdminPage() {
  const [rewardAmount, setRewardAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const user = await fcl.currentUser.snapshot();
        if (user?.addr) {
          setIsAdmin(isAdminUser(user.addr));
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        toast.error('Failed to verify admin status');
      }
    };
    checkAdminStatus();
  }, []);

  // Load pool info on mount
  useEffect(() => {
    const loadPoolInfo = async () => {
      try {
        const pool = await getPoolInfo();
        setPoolInfo(pool);
      } catch (error) {
        console.error('Error loading pool info:', error);
        toast.error('Failed to load pool information');
      }
    };
    loadPoolInfo();
  }, []);

  const handleAddRewards = async () => {
    if (!rewardAmount) return;
    
    const amount = parseFloat(rewardAmount);
    if (amount <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }

    if (!isAdmin) {
      toast.error('You must be logged in as an admin to add rewards');
      return;
    }

    try {
      setIsLoading(true);
      console.log('Adding rewards:', amount, 'using admin key');
      
      const result = await addRewardTokens(amount);
      console.log('Add rewards result:', result);
      
      if (result.status === 4) { // Transaction sealed successfully
        toast.success(`Successfully added ${amount} FLOW as reward tokens!`);
        setRewardAmount('');
        
        // Refresh pool info
        try {
          const pool = await getPoolInfo();
          setPoolInfo(pool);
        } catch (poolError) {
          console.error('Error refreshing pool info:', poolError);
        }
      } else {
        throw new Error(`Transaction failed with status: ${result.status}`);
      }
    } catch (error) {
      console.error('Add rewards error:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('proposer')) {
          toast.error('Authorization error: Please check admin configuration');
        } else if (error.message.includes('insufficient')) {
          toast.error('Insufficient balance in admin account');
        } else {
          toast.error(`Failed to add reward tokens: ${error.message}`);
        }
      } else {
        toast.error('Failed to add reward tokens');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-container">
      <Toaster position="top-right" />
      
      <div className="admin-content">
        <div className="admin-header">
          <h1 className="admin-title">Flow Delegation Pool Admin</h1>
          {!isAdmin && (
            <div className="admin-warning">
              Warning: You are not logged in as an admin. Admin functions will be disabled.
            </div>
          )}
        </div>

        <div className="admin-sections">
          <div className="card">
            <h2 className="card-title">Admin Account</h2>
            <p><strong>Address:</strong> {ADMIN_ACCOUNT_ADDRESS}</p>
            <p><strong>Status:</strong> {isAdmin ? 'Authenticated as Admin' : 'Not Authenticated as Admin'}</p>
          </div>

          <div className="card">
            <h2 className="card-title">Add Reward Tokens</h2>
            <p>Add reward tokens to the pool for distribution to delegators.</p>
            <div className="delegate-form">
              <input
                type="number"
                value={rewardAmount}
                onChange={(e) => setRewardAmount(e.target.value)}
                placeholder="Amount to add as rewards"
                className="input"
                disabled={isLoading || !isAdmin}
                step="0.0001"
                min="0"
              />
              <button 
                onClick={handleAddRewards}
                className="btn btn-primary"
                disabled={isLoading || !rewardAmount || parseFloat(rewardAmount) <= 0 || !isAdmin}
              >
                {isLoading ? 'Adding...' : 'Add Rewards'}
              </button>
            </div>
            {!isAdmin && (
              <p style={{fontSize: '0.9em', color: '#ff4444', marginTop: '10px'}}>
                You must be logged in as an admin to add rewards.
            </p>
            )}
          </div>

          <div className="card">
            <h2 className="card-title">Pool Information</h2>
            <p className="delegation-balance">
              Total Delegated: {poolInfo ? (parseFloat(poolInfo.totalDelegated) / 100000000).toFixed(2) : '0.00'} FLOW
            </p>
            <p><strong>Contract Address:</strong> {ADMIN_ACCOUNT_ADDRESS}</p>
            <p style={{fontSize: '0.9em', color: '#666'}}>
              Rewards are calculated at 1% per week based on delegation time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;