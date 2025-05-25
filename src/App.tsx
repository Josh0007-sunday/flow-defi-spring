import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import {
  authenticate,
  unauthenticate,
  getCurrentUser,
  createDelegator,
  delegateTokens,
  claimRewards,
  getDelegationInfo,
  getPoolInfo,
  getFlowBalance
} from './config/flow';
import type { FCLUser } from './config/flow';
import AdminPage from './pages/AdminPage';
import './App.css';

interface DelegationInfo {
  hasResource: boolean;
  balance: number;
}

interface PoolInfo {
  totalDelegated: string;
}

function MainApp() {
  const [user, setUser] = useState<FCLUser | null>(null);
  const [delegationInfo, setDelegationInfo] = useState<DelegationInfo | null>(null);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [balance, setBalance] = useState(0);
  const [delegateAmount, setDelegateAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const checkUserStatus = async (currentUser: FCLUser) => {
    try {
      setIsLoading(true);
      const info = await getDelegationInfo(currentUser.addr);
      setDelegationInfo(info as DelegationInfo);
      
      const pool = await getPoolInfo();
      setPoolInfo(pool as PoolInfo);
      
      const bal = await getFlowBalance(currentUser.addr);
      setBalance(parseFloat(bal.toString()));
    } catch (error) {
      console.error('Error checking user status:', error);
      toast.error('Error loading user data. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          await checkUserStatus(currentUser);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        toast.error('Error initializing application.');
      } finally {
        setIsInitialized(true);
      }
    };
    
    init();
  }, []);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      await authenticate();
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        await checkUserStatus(currentUser);
        toast.success('Successfully logged in!');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Failed to login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await unauthenticate();
      setUser(null);
      setDelegationInfo(null);
      setPoolInfo(null);
      setBalance(0);
      toast.success('Successfully logged out!');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDelegator = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      await createDelegator();
      toast.success('Delegator created successfully!');
      await checkUserStatus(user);
    } catch (error: any) {
      console.error('Create delegator error:', error);
      toast.error(error.message?.includes('already exists') 
        ? 'You already have a delegator account' 
        : 'Failed to create delegator');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelegate = async () => {
    if (!user || !delegateAmount) return;
    try {
      setIsLoading(true);
      await delegateTokens(parseFloat(delegateAmount));
      toast.success('Successfully delegated tokens!');
      setDelegateAmount('');
      await checkUserStatus(user);
    } catch (error) {
      console.error('Delegate error:', error);
      toast.error('Failed to delegate tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      await claimRewards();
      toast.success('Successfully claimed rewards!');
      await checkUserStatus(user);
    } catch (error) {
      console.error('Claim rewards error:', error);
      toast.error('Failed to claim rewards');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="app-container">
        <div className="app-content">
          <div className="app-header">
            <h1 className="app-title">Flow Delegation Pool V2</h1>
          </div>
          <div className="card">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Toaster position="top-right" />
      <div className="app-content">
        <div className="app-header">
          <h1 className="app-title">Flow Delegation Pool V2</h1>
          <div className="header-buttons">
            <Link 
              to="/admin" 
              className="btn btn-secondary"
              style={{ marginRight: '1rem' }}
            >
              Admin Panel
            </Link>
            {!user ? (
              <button 
                onClick={handleLogin} 
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            ) : (
              <button 
                onClick={handleLogout} 
                className="btn btn-secondary"
                disabled={isLoading}
              >
                {isLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            )}
          </div>
        </div>

        {user && (
          <div className="app-sections">
            <div className="card">
              <h2 className="card-title">Your Account</h2>
              <p><strong>Address:</strong> {user.addr}</p>
              <p><strong>Balance:</strong> {balance.toFixed(4)} FLOW</p>
            </div>

            {!delegationInfo?.hasResource ? (
              <div className="card">
                <h2 className="card-title">Setup Delegator</h2>
                <p>You need to create a delegator resource to start delegating tokens.</p>
                <button 
                  onClick={handleCreateDelegator} 
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating...' : 'Create Delegator'}
                </button>
              </div>
            ) : (
              <>
                <div className="card">
                  <h2 className="card-title">Delegate Tokens</h2>
                  <p><strong>Your Current Delegation:</strong> {delegationInfo.balance} FLOW</p>
                  <div className="delegate-form">
                    <input
                      type="number"
                      value={delegateAmount}
                      onChange={(e) => setDelegateAmount(e.target.value)}
                      placeholder="Amount to delegate"
                      className="input"
                      disabled={isLoading}
                      step="0.0001"
                      min="0"
                    />
                    <button 
                      onClick={handleDelegate} 
                      className="btn btn-primary"
                      disabled={isLoading || !delegateAmount || parseFloat(delegateAmount) <= 0}
                    >
                      {isLoading ? 'Delegating...' : 'Delegate'}
                    </button>
                  </div>
                </div>

                <div className="card">
                  <h2 className="card-title">Claim Rewards</h2>
                  <p>Claim your staking rewards (1% per week based on delegation time).</p>
                  <button 
                    onClick={handleClaimRewards} 
                    className="btn btn-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Claiming...' : 'Claim Rewards'}
                  </button>
                </div>
              </>
            )}

            <div className="card">
              <h2 className="card-title">Pool Information</h2>
              <p className="delegation-balance">
                Total Delegated: {poolInfo ? (parseFloat(poolInfo.totalDelegated) / 100000000).toFixed(2) : '0.00'} FLOW
              </p>
              <p style={{fontSize: '0.9em', color: '#666'}}>
                Rewards are calculated at 1% per week based on delegation time.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
}

export default App;