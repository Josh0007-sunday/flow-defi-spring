import * as fcl from "@onflow/fcl";
import { useCurrentUser } from "../../hooks/useCurrentUSer";
import './WalletConnect.css';

export function WalletButton() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) return (
    <div className="wallet-loading">
      Loading...
    </div>
  );

  const address = user?.addr || '';

  return (
    <div className="wallet-container">
      {user?.loggedIn ? (
        <div className="wallet-connected">
          <div className="wallet-address">
            <span>Wallet: {address.slice(0, 6)}...{address.slice(-4)}</span>
          </div>
          <button 
            onClick={fcl.unauthenticate}
            className="wallet-disconnect-btn"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={fcl.logIn}
          className="wallet-connect-btn"
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
}