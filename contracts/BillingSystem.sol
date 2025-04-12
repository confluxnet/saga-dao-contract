// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title BillingSystem
 * @dev Handles payments and revenue distribution for MCP usage
 */
contract BillingSystem is AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    
    IERC20 public sagaToken;
    address public mcpPool;
    address public dao;
    
    uint256 public constant PLATFORM_FEE = 200; // 2% (200 basis points)
    uint256 public constant DAO_FEE = 300; // 3% (300 basis points)
    uint256 public constant BASIS_POINTS = 10000;
    
    struct Payment {
        address payer;
        address provider;
        uint256 amount;
        uint256 timestamp;
        bool processed;
    }
    
    Counters.Counter private _paymentIds;
    mapping(uint256 => Payment) public payments;
    mapping(address => uint256) public providerBalances;
    mapping(address => uint256) public daoBalances;
    
    event PaymentProcessed(
        uint256 indexed paymentId,
        address indexed payer,
        address indexed provider,
        uint256 amount
    );
    
    event RevenueDistributed(
        address indexed provider,
        uint256 providerAmount,
        uint256 platformAmount,
        uint256 daoAmount
    );
    
    event Withdrawn(
        address indexed account,
        uint256 amount
    );
    
    constructor(
        address _sagaToken,
        address _mcpPool,
        address _dao
    ) {
        require(_sagaToken != address(0), "Invalid SAGA token address");
        require(_mcpPool != address(0), "Invalid MCP pool address");
        require(_dao != address(0), "Invalid DAO address");
        
        sagaToken = IERC20(_sagaToken);
        mcpPool = _mcpPool;
        dao = _dao;
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);
        _setupRole(TREASURER_ROLE, msg.sender);
    }
    
    function _setupRole(bytes32 role, address account) internal override {
        _grantRole(role, account);
        _setRoleAdmin(role, DEFAULT_ADMIN_ROLE);
    }
    
    function processPayment(
        address payer,
        address provider,
        uint256 amount
    ) external onlyRole(OPERATOR_ROLE) nonReentrant returns (uint256) {
        require(payer != address(0), "Invalid payer address");
        require(provider != address(0), "Invalid provider address");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 paymentId = _paymentIds.current();
        _paymentIds.increment();
        
        payments[paymentId] = Payment({
            payer: payer,
            provider: provider,
            amount: amount,
            timestamp: block.timestamp,
            processed: false
        });
        
        emit PaymentProcessed(paymentId, payer, provider, amount);
        
        return paymentId;
    }
    
    function distributeRevenue(uint256 paymentId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Payment storage payment = payments[paymentId];
        require(!payment.processed, "Payment already processed");
        require(payment.amount > 0, "Invalid payment amount");
        
        uint256 platformFee = (payment.amount * PLATFORM_FEE) / BASIS_POINTS;
        uint256 daoFee = (payment.amount * DAO_FEE) / BASIS_POINTS;
        uint256 providerAmount = payment.amount - platformFee - daoFee;
        
        providerBalances[payment.provider] += providerAmount;
        daoBalances[dao] += daoFee;
        
        payment.processed = true;
        
        emit RevenueDistributed(
            payment.provider,
            providerAmount,
            platformFee,
            daoFee
        );
    }
    
    function withdrawProviderFunds() external nonReentrant {
        uint256 amount = providerBalances[msg.sender];
        require(amount > 0, "No funds to withdraw");
        
        providerBalances[msg.sender] = 0;
        require(
            sagaToken.transfer(msg.sender, amount),
            "Token transfer failed"
        );
        
        emit Withdrawn(msg.sender, amount);
    }
    
    function withdrawDaoFunds() external onlyRole(TREASURER_ROLE) nonReentrant {
        uint256 amount = daoBalances[dao];
        require(amount > 0, "No funds to withdraw");
        
        daoBalances[dao] = 0;
        require(
            sagaToken.transfer(dao, amount),
            "Token transfer failed"
        );
        
        emit Withdrawn(dao, amount);
    }
    
    function getPayment(uint256 paymentId) external view returns (
        address payer,
        address provider,
        uint256 amount,
        uint256 timestamp,
        bool processed
    ) {
        Payment storage payment = payments[paymentId];
        return (
            payment.payer,
            payment.provider,
            payment.amount,
            payment.timestamp,
            payment.processed
        );
    }
    
    function getProviderBalance(address provider) external view returns (uint256) {
        return providerBalances[provider];
    }
    
    function getDaoBalance() external view returns (uint256) {
        return daoBalances[dao];
    }
} 