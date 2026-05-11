import { useState, useEffect, useCallback } from "react";
import "./App.css";
import jsPDF from "jspdf";
import QRCode from "react-qr-code";

import {
  createWallet,
  importWallet,
  restoreWalletFromMnemonic,
  getBalance,
  sendTransaction,
  encryptWallet,
  decryptWallet,
  isValidAddress
} from "./wallet";

const ETHERSCAN_API_KEY = process.env.REACT_APP_ETHERSCAN_API_KEY || "";

function App() {
  const [wallets, setWallets] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [balance, setBalance] = useState(null);

  const [walletName, setWalletName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [walletDescription, setWalletDescription] = useState("");
  const [importPrivateKey, setImportPrivateKey] = useState("");
  const [mnemonicPhrase, setMnemonicPhrase] = useState("");

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [blockchainTransactions, setBlockchainTransactions] = useState([]);

  const [password, setPassword] = useState("");
  const [notification, setNotification] = useState("");

  const [ethPrice, setEthPrice] = useState(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [loadingBlockchainTx, setLoadingBlockchainTx] = useState(false);
  const [sendingTx, setSendingTx] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [autoRefreshBalance, setAutoRefreshBalance] = useState(true);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);

  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [walletSearch, setWalletSearch] = useState("");
  const [isEditingWallet, setIsEditingWallet] = useState(false);
  const [editWalletName, setEditWalletName] = useState("");
  const [editOwnerName, setEditOwnerName] = useState("");
  const [editWalletDescription, setEditWalletDescription] = useState("");

  const [activePage, setActivePage] = useState("dashboard");

  const currentWallet = wallets[currentIndex];
  const mainWallet = wallets.find((wallet) => wallet.isMain);

  const getWalletStorageKey = (username) => `wallets_${username}`;

  const showNotificationMessage = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(""), 3000);
  };

  const clearWalletState = () => {
    setBalance(null);
    setTxHash("");
    setTo("");
    setAmount("");
    setPassword("");
    setShowPrivateKey(false);
    setBlockchainTransactions([]);
  };

  const clearCreateFields = () => {
    setWalletName("");
    setOwnerName("");
    setWalletDescription("");
  };

  const saveWallets = (updatedWallets) => {
    setWallets(updatedWallets);

    if (currentUser) {
      localStorage.setItem(
        getWalletStorageKey(currentUser),
        JSON.stringify(updatedWallets)
      );
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");

    if (savedUser) {
      setCurrentUser(savedUser);
      setIsLoggedIn(true);

      const userWallets =
        JSON.parse(localStorage.getItem(getWalletStorageKey(savedUser))) || [];

      setWallets(userWallets);
      setCurrentIndex(0);
    }
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showNotificationMessage("Copied to clipboard!");
  };

  const formatEthFromWei = (weiValue) => {
    const ethValue = Number(weiValue) / 1e18;
    return ethValue.toFixed(6);
  };

  const handleGetBalance = useCallback(
    async (silent = false) => {
      if (!currentWallet) {
        if (!silent) showNotificationMessage("Create or import a wallet first!");
        return;
      }

      try {
        setLoadingBalance(true);
        const bal = await getBalance(currentWallet.address);
        setBalance(bal);

        if (!silent) {
          showNotificationMessage("Balance updated!");
        }
      } catch (error) {
        console.log(error);

        if (!silent) {
          showNotificationMessage("Could not fetch balance!");
        }
      } finally {
        setLoadingBalance(false);
      }
    },
    [currentWallet]
  );

  useEffect(() => {
    if (!currentWallet || !autoRefreshBalance) return;

    handleGetBalance(true);

    const interval = setInterval(() => {
      handleGetBalance(true);
    }, 20000);

    return () => clearInterval(interval);
  }, [currentWallet, autoRefreshBalance, handleGetBalance]);

  const fetchBlockchainTransactions = async () => {
    if (!currentWallet) {
      showNotificationMessage("Create or import a wallet first!");
      return;
    }

    if (!ETHERSCAN_API_KEY) {
      showNotificationMessage("Add your Etherscan API key in .env first!");
      return;
    }

    try {
      setLoadingBlockchainTx(true);

      const url = `https://api.etherscan.io/v2/api?chainid=11155111&module=account&action=txlist&address=${currentWallet.address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${ETHERSCAN_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "1" && Array.isArray(data.result)) {
        setBlockchainTransactions(data.result);
        showNotificationMessage("Blockchain transactions loaded!");
      } else {
        setBlockchainTransactions([]);
        showNotificationMessage("No blockchain transactions found!");
      }
    } catch (error) {
      console.log(error);
      showNotificationMessage("Could not load blockchain transactions!");
    } finally {
      setLoadingBlockchainTx(false);
    }
  };

  const validateTransaction = async () => {
    if (!currentWallet) {
      showNotificationMessage("Create or import a wallet first!");
      return false;
    }

    if (!currentWallet.privateKey) {
      showNotificationMessage("Wallet is locked. Unlock it first!");
      return false;
    }

    if (!to.trim() || !amount.trim()) {
      showNotificationMessage("Fill recipient address and amount!");
      return false;
    }

    if (!isValidAddress(to.trim())) {
      showNotificationMessage("Recipient address is invalid!");
      return false;
    }

    if (to.trim().toLowerCase() === currentWallet.address.toLowerCase()) {
      showNotificationMessage("You cannot send ETH to the same wallet!");
      return false;
    }

    const amountNumber = Number(amount);

    if (!Number.isFinite(amountNumber)) {
      showNotificationMessage("Amount must be a valid number!");
      return false;
    }

    if (amountNumber <= 0) {
      showNotificationMessage("Amount must be greater than 0!");
      return false;
    }

    let availableBalance = balance;

    if (availableBalance === null) {
      try {
        availableBalance = await getBalance(currentWallet.address);
        setBalance(availableBalance);
      } catch (error) {
        console.log(error);
        showNotificationMessage("Could not verify wallet balance!");
        return false;
      }
    }

    const balanceNumber = Number(availableBalance);

    if (amountNumber >= balanceNumber) {
      showNotificationMessage(
        "Insufficient balance. Leave some ETH for gas fee!"
      );
      return false;
    }

    return true;
  };

  const handleSelectWallet = (index) => {
    setCurrentIndex(index);
    setIsEditingWallet(false);
    clearWalletState();
    setActivePage("dashboard");
  };

  const startEditWallet = () => {
    if (!currentWallet) return;

    setEditWalletName(currentWallet.name || "");
    setEditOwnerName(currentWallet.owner || "");
    setEditWalletDescription(currentWallet.description || "");
    setIsEditingWallet(true);
  };

  const cancelEditWallet = () => {
    setIsEditingWallet(false);
    setEditWalletName("");
    setEditOwnerName("");
    setEditWalletDescription("");
  };

  const saveWalletDetails = () => {
    if (!currentWallet) {
      showNotificationMessage("No wallet selected!");
      return;
    }

    if (!editWalletName.trim()) {
      showNotificationMessage("Wallet name cannot be empty!");
      return;
    }

    const updatedWallet = {
      ...currentWallet,
      name: editWalletName.trim(),
      owner: editOwnerName.trim() || currentUser || "Unknown owner",
      description: editWalletDescription.trim() || "No description added",
      updatedAt: new Date().toLocaleString()
    };

    const updatedWallets = [...wallets];
    updatedWallets[currentIndex] = updatedWallet;

    saveWallets(updatedWallets);
    setIsEditingWallet(false);

    showNotificationMessage("Wallet details updated!");
  };

  const filteredWallets = wallets
    .map((wallet, index) => ({ ...wallet, originalIndex: index }))
    .filter((wallet) => {
      const search = walletSearch.toLowerCase();

      return (
        wallet.name?.toLowerCase().includes(search) ||
        wallet.owner?.toLowerCase().includes(search) ||
        wallet.address?.toLowerCase().includes(search) ||
        wallet.type?.toLowerCase().includes(search)
      );
    });

  const handleSetMainWallet = () => {
    if (!currentWallet) {
      showNotificationMessage("No wallet selected!");
      return;
    }

    const updatedWallets = wallets.map((wallet, index) => ({
      ...wallet,
      isMain: index === currentIndex
    }));

    saveWallets(updatedWallets);
    showNotificationMessage("Main wallet updated!");
  };

  const handleRegister = () => {
    if (!authUsername || !authPassword || !confirmPassword) {
      showNotificationMessage("Complete all register fields!");
      return;
    }

    if (authPassword !== confirmPassword) {
      showNotificationMessage("Passwords do not match!");
      return;
    }

    const users = JSON.parse(localStorage.getItem("users")) || [];
    const userExists = users.find((user) => user.username === authUsername);

    if (userExists) {
      showNotificationMessage("Username already exists!");
      return;
    }

    const newUser = {
      username: authUsername,
      password: authPassword,
      createdAt: new Date().toLocaleString()
    };

    localStorage.setItem("users", JSON.stringify([...users, newUser]));
    localStorage.setItem(getWalletStorageKey(authUsername), JSON.stringify([]));

    setAuthUsername("");
    setAuthPassword("");
    setConfirmPassword("");
    setAuthMode("login");

    showNotificationMessage("Account created successfully!");
  };

  const handleLogin = () => {
    if (!authUsername || !authPassword) {
      showNotificationMessage("Enter username and password!");
      return;
    }

    const users = JSON.parse(localStorage.getItem("users")) || [];

    const foundUser = users.find(
      (user) => user.username === authUsername && user.password === authPassword
    );

    if (!foundUser) {
      showNotificationMessage("Wrong username or password!");
      return;
    }

    const userWallets =
      JSON.parse(localStorage.getItem(getWalletStorageKey(foundUser.username))) ||
      [];

    setCurrentUser(foundUser.username);
    setIsLoggedIn(true);
    localStorage.setItem("currentUser", foundUser.username);

    setWallets(userWallets);
    setCurrentIndex(0);
    setActivePage("dashboard");
    clearWalletState();

    setAuthUsername("");
    setAuthPassword("");
    setConfirmPassword("");

    showNotificationMessage("Login successful!");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setWallets([]);
    setCurrentIndex(0);
    setActivePage("dashboard");
    clearWalletState();

    localStorage.removeItem("currentUser");

    showNotificationMessage("Logged out!");
  };

  const handleCreate = () => {
    const generatedWallet = createWallet();

    const newWallet = {
      ...generatedWallet,
      name: walletName || `Wallet ${wallets.length + 1}`,
      owner: ownerName || currentUser || "Unknown owner",
      description: walletDescription || "No description added",
      network: "Sepolia Testnet",
      type: "Personal Wallet",
      isMain: wallets.length === 0,
      createdAt: new Date().toLocaleString()
    };

    const updatedWallets = [...wallets, newWallet];

    saveWallets(updatedWallets);
    setCurrentIndex(updatedWallets.length - 1);
    clearWalletState();
    clearCreateFields();
    setActivePage("dashboard");

    showNotificationMessage("Wallet created successfully!");
  };

  const handleImportWallet = () => {
    if (!importPrivateKey) {
      showNotificationMessage("Enter the private key first!");
      return;
    }

    try {
      const generatedImportedWallet = importWallet(importPrivateKey);

      const importedWallet = {
        ...generatedImportedWallet,
        name: walletName || "Imported Wallet",
        owner: ownerName || currentUser || "Unknown owner",
        description: walletDescription || "Wallet imported using private key",
        network: "Sepolia Testnet",
        type: "Imported Wallet",
        isMain: wallets.length === 0,
        createdAt: new Date().toLocaleString()
      };

      const updatedWallets = [...wallets, importedWallet];

      saveWallets(updatedWallets);
      setCurrentIndex(updatedWallets.length - 1);

      clearWalletState();
      clearCreateFields();
      setImportPrivateKey("");
      setActivePage("dashboard");

      showNotificationMessage("Wallet imported successfully!");
    } catch (error) {
      console.log(error);
      showNotificationMessage("Invalid private key!");
    }
  };

  const handleRestoreWallet = () => {
    if (!mnemonicPhrase) {
      showNotificationMessage("Enter mnemonic phrase first!");
      return;
    }

    try {
      const generatedRestoredWallet = restoreWalletFromMnemonic(mnemonicPhrase);

      const restoredWallet = {
        ...generatedRestoredWallet,
        name: walletName || "Restored Wallet",
        owner: ownerName || currentUser || "Unknown owner",
        description: walletDescription || "Wallet restored using mnemonic phrase",
        network: "Sepolia Testnet",
        type: "Restored Wallet",
        isMain: wallets.length === 0,
        createdAt: new Date().toLocaleString()
      };

      const updatedWallets = [...wallets, restoredWallet];

      saveWallets(updatedWallets);
      setCurrentIndex(updatedWallets.length - 1);

      clearWalletState();
      clearCreateFields();
      setMnemonicPhrase("");
      setActivePage("dashboard");

      showNotificationMessage("Wallet restored successfully!");
    } catch (error) {
      console.log(error);
      showNotificationMessage("Invalid mnemonic phrase!");
    }
  };

  const handleDeleteWallet = () => {
    if (!currentWallet) {
      showNotificationMessage("No wallet available to delete!");
      return;
    }

    const confirmDelete = window.confirm(
      `Sigur vrei să ștergi wallet-ul "${
        currentWallet.name || currentWallet.address
      }"?\n\nDacă nu ai backup la private key / PDF / JSON, nu îl vei mai putea recupera.`
    );

    if (!confirmDelete) return;

    let updatedWallets = wallets.filter((_, index) => index !== currentIndex);

    if (currentWallet.isMain && updatedWallets.length > 0) {
      updatedWallets = updatedWallets.map((wallet, index) => ({
        ...wallet,
        isMain: index === 0
      }));
    }

    saveWallets(updatedWallets);

    if (updatedWallets.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= updatedWallets.length) {
      setCurrentIndex(updatedWallets.length - 1);
    }

    clearWalletState();
    showNotificationMessage("Wallet deleted successfully!");
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsEditingWallet(false);
      clearWalletState();
    }
  };

  const handleNext = () => {
    if (currentIndex < wallets.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsEditingWallet(false);
      clearWalletState();
    }
  };

  const getEthPrice = async () => {
    try {
      setLoadingPrice(true);

      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );

      const data = await response.json();
      setEthPrice(data.ethereum.usd);

      showNotificationMessage("ETH price updated!");
    } catch (error) {
      console.log(error);
      showNotificationMessage("Could not fetch ETH price!");
    } finally {
      setLoadingPrice(false);
    }
  };

  const handleEncryptCurrentWallet = async () => {
    if (!currentWallet) {
      showNotificationMessage("Create or import a wallet first!");
      return;
    }

    if (!password) {
      showNotificationMessage("Enter a password!");
      return;
    }

    if (!currentWallet.privateKey) {
      showNotificationMessage("Wallet is already locked/encrypted!");
      return;
    }

    try {
      setEncrypting(true);

      const encryptedJson = await encryptWallet(
        currentWallet.privateKey,
        password
      );

      const updatedWallet = {
        ...currentWallet,
        privateKey: undefined,
        mnemonic: undefined,
        encryptedJson
      };

      const updatedWallets = [...wallets];
      updatedWallets[currentIndex] = updatedWallet;

      saveWallets(updatedWallets);
      setPassword("");
      setShowPrivateKey(false);

      showNotificationMessage("Wallet encrypted successfully!");
    } catch (error) {
      console.log(error);
      showNotificationMessage("Encryption failed!");
    } finally {
      setEncrypting(false);
    }
  };

  const handleUnlockWallet = async () => {
    if (!currentWallet) {
      showNotificationMessage("Create or import a wallet first!");
      return;
    }

    if (!password) {
      showNotificationMessage("Enter the password!");
      return;
    }

    if (!currentWallet.encryptedJson) {
      showNotificationMessage("This wallet is not encrypted!");
      return;
    }

    try {
      setUnlocking(true);

      const decryptedWallet = await decryptWallet(
        currentWallet.encryptedJson,
        password
      );

      const updatedWallet = {
        ...currentWallet,
        privateKey: decryptedWallet.privateKey
      };

      const updatedWallets = [...wallets];
      updatedWallets[currentIndex] = updatedWallet;

      saveWallets(updatedWallets);
      setPassword("");
      setShowPrivateKey(false);

      showNotificationMessage("Wallet unlocked!");
    } catch (error) {
      console.log(error);
      showNotificationMessage("Wrong password!");
    } finally {
      setUnlocking(false);
    }
  };

  const handleLockWallet = () => {
    if (!currentWallet) {
      showNotificationMessage("No wallet selected!");
      return;
    }

    if (!currentWallet.encryptedJson) {
      showNotificationMessage("Wallet is not encrypted!");
      return;
    }

    const updatedWallet = {
      ...currentWallet,
      privateKey: undefined,
      mnemonic: undefined
    };

    const updatedWallets = [...wallets];
    updatedWallets[currentIndex] = updatedWallet;

    saveWallets(updatedWallets);
    setPassword("");
    setShowPrivateKey(false);

    showNotificationMessage("Wallet locked!");
  };

  const handleSendTransaction = async () => {
    const isValidTransaction = await validateTransaction();

    if (!isValidTransaction) return;

    try {
      setSendingTx(true);

      const hash = await sendTransaction(
        currentWallet.privateKey,
        to.trim(),
        amount.trim()
      );

      setTxHash(hash);
      setTo("");
      setAmount("");

      showNotificationMessage("Transaction sent successfully!");
      await handleGetBalance(true);
      await fetchBlockchainTransactions();
    } catch (error) {
      console.log(error);
      showNotificationMessage("Transaction failed! Check gas fee and balance.");
    } finally {
      setSendingTx(false);
    }
  };

  const downloadWallet = () => {
    if (!currentWallet) {
      showNotificationMessage("Create or import a wallet first!");
      return;
    }

    const data = JSON.stringify(currentWallet, null, 2);
    const blob = new Blob([data], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `wallet-${currentIndex + 1}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showNotificationMessage("JSON exported!");
  };

  const downloadWalletPDF = () => {
    if (!currentWallet) {
      showNotificationMessage("Create or import a wallet first!");
      return;
    }

    const doc = new jsPDF();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 35, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("Crypto Wallet Report", 20, 22);

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(10);
    doc.text(`Generated at: ${new Date().toLocaleString()}`, 20, 43);

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(16);
    doc.text("Wallet Summary", 20, 58);

    doc.setDrawColor(220, 220, 220);
    doc.line(20, 62, 190, 62);

    doc.setFontSize(11);

    const rows = [
      ["Wallet Name", currentWallet.name || "-"],
      ["Owner", currentWallet.owner || "-"],
      ["Type", currentWallet.type || "-"],
      ["Network", currentWallet.network || "Sepolia Testnet"],
      ["Main Wallet", currentWallet.isMain ? "Yes" : "No"],
      ["Created At", currentWallet.createdAt || "-"],
      ["Last Updated", currentWallet.updatedAt || "-"],
      ["Status", currentWallet.privateKey ? "Unlocked" : "Locked / Encrypted"],
      ["Balance", balance !== null ? `${balance} ETH` : "Not checked"],
      [
        "Balance USD",
        balance !== null && ethPrice
          ? `$${(Number(balance) * ethPrice).toFixed(2)}`
          : "Not available"
      ]
    ];

    let y = 75;

    rows.forEach(([label, value]) => {
      doc.setTextColor(80, 80, 80);
      doc.text(`${label}:`, 20, y);

      doc.setTextColor(20, 20, 20);
      doc.text(String(value), 65, y, { maxWidth: 120 });

      y += 10;
    });

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(16);
    doc.text("Wallet Address", 20, y + 8);

    doc.setDrawColor(220, 220, 220);
    doc.line(20, y + 12, 190, y + 12);

    doc.setFontSize(10);
    doc.text(currentWallet.address, 20, y + 25, { maxWidth: 170 });

    doc.setFontSize(16);
    doc.text("Description", 20, y + 43);

    doc.setDrawColor(220, 220, 220);
    doc.line(20, y + 47, 190, y + 47);

    doc.setFontSize(11);
    doc.text(currentWallet.description || "-", 20, y + 60, { maxWidth: 170 });

    doc.setFontSize(16);
    doc.text("Security Notice", 20, y + 83);

    doc.setDrawColor(220, 220, 220);
    doc.line(20, y + 87, 190, y + 87);

    doc.setFontSize(10);
    doc.setTextColor(180, 60, 60);

    if (currentWallet.privateKey) {
      doc.text(
        "Private key is available because the wallet is currently unlocked. Keep this file private.",
        20,
        y + 100,
        { maxWidth: 170 }
      );

      doc.setTextColor(20, 20, 20);
      doc.text("Private Key:", 20, y + 115);
      doc.text(currentWallet.privateKey, 20, y + 125, { maxWidth: 170 });
    } else {
      doc.text(
        "Private key is hidden because the wallet is locked/encrypted.",
        20,
        y + 100,
        { maxWidth: 170 }
      );
    }

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    doc.text("Educational wallet application for Sepolia Testnet.", 20, 285);

    doc.save(`wallet-report-${currentIndex + 1}.pdf`);
    showNotificationMessage("Professional PDF exported!");
  };

  if (!isLoggedIn) {
    return (
      <div className="app-container">
        {notification && <div className="toast">{notification}</div>}

        <div className="wallet-card login-card">
          <h1 className="title">My Crypto Wallet</h1>
          <p className="subtitle">
            {authMode === "login" ? "Secure Login" : "Create Account"}
          </p>

          <div className="section">
            <h2>{authMode === "login" ? "Login" : "Register"}</h2>

            <input
              type="text"
              placeholder="Username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />

            {authMode === "register" && (
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            )}

            {authMode === "login" ? (
              <button onClick={handleLogin}>Login</button>
            ) : (
              <button onClick={handleRegister}>Create Account</button>
            )}

            <p className="small-text">
              {authMode === "login" ? "Nu ai cont?" : "Ai deja cont?"}{" "}
              <button
                className="secondary-btn"
                onClick={() =>
                  setAuthMode(authMode === "login" ? "register" : "login")
                }
              >
                {authMode === "login" ? "Register" : "Back to Login"}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {notification && <div className="toast">{notification}</div>}

      <div className="wallet-card">
        <h1 className="title">My Crypto Wallet</h1>

        <p className="subtitle">
          Sepolia Testnet Wallet Application — Logged in as {currentUser}
        </p>

        <div className="theme-toggle">
          <button className="secondary-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="nav-tabs">
          <button
            className={activePage === "dashboard" ? "active-tab" : "secondary-btn"}
            onClick={() => setActivePage("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={activePage === "send" ? "active-tab" : "secondary-btn"}
            onClick={() => setActivePage("send")}
          >
            Send Transaction
          </button>

          <button
            className={activePage === "history" ? "active-tab" : "secondary-btn"}
            onClick={() => setActivePage("history")}
          >
            Transaction History
          </button>

          <button
            className={activePage === "manage" ? "active-tab" : "secondary-btn"}
            onClick={() => setActivePage("manage")}
          >
            Manage Wallets
          </button>
        </div>

        {activePage === "dashboard" && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Wallets</h3>
                <p>{wallets.length}</p>
              </div>

              <div className="stat-card">
                <h3>Main Wallet</h3>
                <p>{mainWallet ? "⭐ Set" : "None"}</p>
              </div>

              <div className="stat-card">
                <h3>Network</h3>
                <p>Sepolia</p>
              </div>
            </div>

            <div className="section full-width">
              <h2>Search Wallet</h2>

              <input
                type="text"
                placeholder="Search by wallet name, owner, address or type"
                value={walletSearch}
                onChange={(e) => setWalletSearch(e.target.value)}
              />

              {wallets.length > 0 && (
                <p className="small-text">
                  Showing {filteredWallets.length} of {wallets.length} wallet(s)
                </p>
              )}

              {walletSearch && filteredWallets.length === 0 && (
                <p className="small-text">No wallet found for this search.</p>
              )}

              {walletSearch &&
                filteredWallets.map((wallet) => (
                  <div key={wallet.address} className="transaction-box">
                    <p>
                      <b>
                        {wallet.isMain ? "⭐ " : ""}
                        {wallet.name}
                      </b>
                    </p>

                    <p>
                      <b>Owner:</b> {wallet.owner}
                    </p>

                    <p>
                      <b>Address:</b> {wallet.address}
                    </p>

                    <p>
                      <b>Type:</b> {wallet.type}
                    </p>

                    <button
                      className="secondary-btn"
                      onClick={() => handleSelectWallet(wallet.originalIndex)}
                    >
                      Open Wallet
                    </button>
                  </div>
                ))}
            </div>

            <div className="actions">
              <button className="secondary-btn" onClick={handlePrevious}>
                ⬅ Previous
              </button>

              <button className="secondary-btn" onClick={handleNext}>
                Next ➡
              </button>

              <button className="secondary-btn" onClick={handleSetMainWallet}>
                ⭐ Set as Main Wallet
              </button>

              <button onClick={downloadWallet}>Download JSON</button>

              <button onClick={downloadWalletPDF}>Download PDF</button>

              <button className="danger-btn" onClick={handleDeleteWallet}>
                Delete Current Wallet
              </button>
            </div>

            {currentWallet && (
              <div className="dashboard-grid">
                <div className="section wallet-info full-width">
                  <h2>
                    Wallet Details {currentWallet.isMain ? "⭐ Main Wallet" : ""}
                  </h2>

                  <p>
                    <b>Wallet:</b> {currentIndex + 1} / {wallets.length}
                  </p>

                  <p>
                    <b>Name:</b> {currentWallet.name || "-"}
                  </p>

                  <p>
                    <b>Owner:</b> {currentWallet.owner || "-"}
                  </p>

                  <p>
                    <b>Description:</b> {currentWallet.description || "-"}
                  </p>

                  <p>
                    <b>Type:</b> {currentWallet.type || "Personal Wallet"}
                  </p>

                  <p>
                    <b>Main Wallet:</b> {currentWallet.isMain ? "Yes ⭐" : "No"}
                  </p>

                  <p>
                    <b>Network:</b> {currentWallet.network || "Sepolia Testnet"}
                  </p>

                  <p>
                    <b>Created:</b> {currentWallet.createdAt || "-"}
                  </p>

                  {currentWallet.updatedAt && (
                    <p>
                      <b>Last Updated:</b> {currentWallet.updatedAt}
                    </p>
                  )}

                  <p>
                    <b>Address:</b> {currentWallet.address}
                  </p>

                  {!isEditingWallet ? (
                    <button className="secondary-btn" onClick={startEditWallet}>
                      Edit Wallet Details
                    </button>
                  ) : (
                    <div className="section">
                      <h2>Edit Wallet Details</h2>

                      <input
                        type="text"
                        placeholder="Wallet name"
                        value={editWalletName}
                        onChange={(e) => setEditWalletName(e.target.value)}
                      />

                      <input
                        type="text"
                        placeholder="Owner name"
                        value={editOwnerName}
                        onChange={(e) => setEditOwnerName(e.target.value)}
                      />

                      <input
                        type="text"
                        placeholder="Description"
                        value={editWalletDescription}
                        onChange={(e) =>
                          setEditWalletDescription(e.target.value)
                        }
                      />

                      <div className="actions">
                        <button onClick={saveWalletDetails}>Save Changes</button>

                        <button
                          className="secondary-btn"
                          onClick={cancelEditWallet}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    className="secondary-btn"
                    onClick={() => copyToClipboard(currentWallet.address)}
                  >
                    Copy Address
                  </button>

                  <div className="qr-box">
                    <QRCode
                      value={`https://sepolia.etherscan.io/address/${currentWallet.address}`}
                      size={140}
                    />
                    <p className="small-text">
                      Scan to view wallet on Sepolia Etherscan
                    </p>
                  </div>

                  <p>
                    <b>Status:</b>{" "}
                    <span
                      className={
                        currentWallet.privateKey
                          ? "status-unlocked"
                          : "status-locked"
                      }
                    >
                      {currentWallet.privateKey
                        ? "Unlocked"
                        : "Locked / Encrypted"}
                    </span>
                  </p>

                  {currentWallet.privateKey && (
                    <>
                      <p>
                        <b>Private Key:</b>{" "}
                        {showPrivateKey
                          ? currentWallet.privateKey
                          : "••••••••••••••••••••••••••••••••••••••••"}
                      </p>

                      <button
                        className="secondary-btn"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                      >
                        {showPrivateKey ? "Hide Private Key" : "Show Private Key"}
                      </button>

                      {showPrivateKey && (
                        <button
                          className="secondary-btn"
                          onClick={() => copyToClipboard(currentWallet.privateKey)}
                        >
                          Copy Private Key
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="section">
                  <h2>Security</h2>

                  <input
                    type="password"
                    placeholder="Enter wallet password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  <div className="actions">
                    <button
                      onClick={handleEncryptCurrentWallet}
                      disabled={encrypting}
                    >
                      {encrypting ? "Encrypting..." : "Encrypt Wallet"}
                    </button>

                    <button
                      className="secondary-btn"
                      onClick={handleUnlockWallet}
                      disabled={unlocking}
                    >
                      {unlocking ? "Unlocking..." : "Unlock Wallet"}
                    </button>

                    <button className="secondary-btn" onClick={handleLockWallet}>
                      Lock Wallet
                    </button>
                  </div>
                </div>

                <div className="section">
                  <h2>Balance</h2>

                  <button
                    onClick={() => handleGetBalance(false)}
                    disabled={loadingBalance}
                  >
                    {loadingBalance ? "Loading..." : "Check Balance"}
                  </button>

                  <button onClick={getEthPrice} disabled={loadingPrice}>
                    {loadingPrice ? "Loading..." : "Get ETH Price"}
                  </button>

                  <button
                    className="secondary-btn"
                    onClick={() => setAutoRefreshBalance(!autoRefreshBalance)}
                  >
                    Auto Refresh: {autoRefreshBalance ? "ON" : "OFF"}
                  </button>

                  {balance !== null && <p className="balance">{balance} ETH</p>}

                  {ethPrice && (
                    <p>
                      <b>ETH Price:</b> ${ethPrice}
                    </p>
                  )}

                  {balance !== null && ethPrice && (
                    <p>
                      <b>Balance in USD:</b> $
                      {(Number(balance) * ethPrice).toFixed(2)}
                    </p>
                  )}

                  <p className="small-text">
                    Balance auto refreshes every 20 seconds when enabled.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {activePage === "send" && (
          <div className="section full-width">
            <h2>Send Transaction</h2>

            {!currentWallet ? (
              <p className="small-text">Create or import a wallet first.</p>
            ) : (
              <>
                <p>
                  <b>From wallet:</b> {currentWallet.name} —{" "}
                  {currentWallet.address}
                </p>

                <input
                  type="text"
                  placeholder="Recipient Address"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />

                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  placeholder="Amount ETH"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />

                <p className="small-text">
                  Suma trebuie să fie mai mare decât 0 și mai mică decât soldul
                  disponibil, pentru a rămâne ETH pentru gas fee.
                </p>

                <button onClick={handleSendTransaction} disabled={sendingTx}>
                  {sendingTx ? "Sending..." : "Send ETH"}
                </button>

                {txHash && (
                  <p>
                    <b>Transaction Hash:</b>{" "}
                    <a
                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on Sepolia Etherscan
                    </a>{" "}
                    <button
                      className="secondary-btn"
                      onClick={() => copyToClipboard(txHash)}
                    >
                      Copy Hash
                    </button>
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {activePage === "history" && (
          <div className="section full-width">
            <h2>Blockchain Transaction History</h2>

            <button
              onClick={fetchBlockchainTransactions}
              disabled={loadingBlockchainTx}
            >
              {loadingBlockchainTx
                ? "Loading blockchain transactions..."
                : "Load Blockchain Transactions"}
            </button>

            <p className="small-text">
              Această secțiune citește tranzacțiile reale de pe Sepolia prin
              Etherscan API.
            </p>

            {blockchainTransactions.length > 0 &&
              blockchainTransactions.map((tx, index) => (
                <div key={index} className="transaction-box">
                  <p>
                    <b>Hash:</b> {tx.hash}
                  </p>

                  <p>
                    <b>From:</b> {tx.from}
                  </p>

                  <p>
                    <b>To:</b> {tx.to}
                  </p>

                  <p>
                    <b>Amount:</b> {formatEthFromWei(tx.value)} ETH
                  </p>

                  <p>
                    <b>Date:</b>{" "}
                    {new Date(Number(tx.timeStamp) * 1000).toLocaleString()}
                  </p>

                  <p>
                    <b>Confirmations:</b> {tx.confirmations}
                  </p>

                  <a
                    href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Sepolia Etherscan
                  </a>{" "}

                  <button
                    className="secondary-btn"
                    onClick={() => copyToClipboard(tx.hash)}
                  >
                    Copy Hash
                  </button>
                </div>
              ))}
          </div>
        )}

        {activePage === "manage" && (
          <div className="section full-width">
            <h2>Create Custom Wallet</h2>

            <input
              type="text"
              placeholder="Wallet name"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
            />

            <input
              type="text"
              placeholder="Owner name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />

            <input
              type="text"
              placeholder="Description"
              value={walletDescription}
              onChange={(e) => setWalletDescription(e.target.value)}
            />

            <button onClick={handleCreate}>+ Create Wallet</button>

            <hr />

            <h2>Import Wallet</h2>

            <input
              type="password"
              placeholder="Private key"
              value={importPrivateKey}
              onChange={(e) => setImportPrivateKey(e.target.value)}
            />

            <button onClick={handleImportWallet}>Import Wallet</button>

            <hr />

            <h2>Restore Wallet from Mnemonic</h2>

            <input
              type="text"
              placeholder="Enter 12-word mnemonic phrase"
              value={mnemonicPhrase}
              onChange={(e) => setMnemonicPhrase(e.target.value)}
            />

            <button onClick={handleRestoreWallet}>Restore Wallet</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;