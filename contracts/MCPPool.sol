// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./SagaToken.sol";

/**
 * @title MCPPool
 * @dev Contract for managing MCP pools in the SAGA DAO marketplace
 */
contract MCPPool is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");
    
    SagaToken public sagaToken;
    
    struct MCP {
        uint256 id;
        string name;
        string description;
        string apiEndpoint;
        string implementation;
        address owner;
        uint256 pricePerCall;
        bool isApproved;
        bool isActive;
        uint256 totalCalls;
        uint256 totalRevenue;
    }
    
    struct Usage {
        uint256 mcpId;
        address user;
        uint256 calls;
        uint256 lastUsed;
    }
    
    mapping(uint256 => MCP) public mcps;
    mapping(address => Usage[]) public userUsage;
    mapping(uint256 => mapping(address => uint256)) public userMCPCalls;
    
    uint256 public mcpCount;
    uint256 public minApprovalVotes;
    
    event MCPRegistered(uint256 indexed id, string name, address owner);
    event MCPApproved(uint256 indexed id, address approver);
    event MCPRejected(uint256 indexed id, address rejector);
    event MCPUsed(uint256 indexed id, address user, uint256 calls);
    event RevenueCollected(uint256 indexed mcpId, address owner, uint256 amount);
    
    constructor(address _sagaToken, address _admin) {
        sagaToken = SagaToken(_sagaToken);
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _setupRole(ADMIN_ROLE, _admin);
        _setupRole(REVIEWER_ROLE, _admin);
        minApprovalVotes = 3;
    }
    
    /**
     * @dev Register a new MCP
     * @param _name Name of the MCP
     * @param _description Description of the MCP
     * @param _apiEndpoint API endpoint for the MCP
     * @param _implementation Implementation details
     * @param _pricePerCall Price per API call in SAGA tokens
     */
    function registerMCP(
        string memory _name,
        string memory _description,
        string memory _apiEndpoint,
        string memory _implementation,
        uint256 _pricePerCall
    ) public returns (uint256) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_apiEndpoint).length > 0, "API endpoint cannot be empty");
        require(_pricePerCall > 0, "Price must be greater than 0");
        
        uint256 mcpId = mcpCount++;
        
        mcps[mcpId] = MCP({
            id: mcpId,
            name: _name,
            description: _description,
            apiEndpoint: _apiEndpoint,
            implementation: _implementation,
            owner: msg.sender,
            pricePerCall: _pricePerCall,
            isApproved: false,
            isActive: false,
            totalCalls: 0,
            totalRevenue: 0
        });
        
        emit MCPRegistered(mcpId, _name, msg.sender);
        return mcpId;
    }
    
    /**
     * @dev Approve an MCP
     * @param _mcpId ID of the MCP to approve
     */
    function approveMCP(uint256 _mcpId) public onlyRole(REVIEWER_ROLE) {
        require(_mcpId < mcpCount, "MCP does not exist");
        require(!mcps[_mcpId].isApproved, "MCP already approved");
        
        mcps[_mcpId].isApproved = true;
        mcps[_mcpId].isActive = true;
        
        emit MCPApproved(_mcpId, msg.sender);
    }
    
    /**
     * @dev Reject an MCP
     * @param _mcpId ID of the MCP to reject
     */
    function rejectMCP(uint256 _mcpId) public onlyRole(REVIEWER_ROLE) {
        require(_mcpId < mcpCount, "MCP does not exist");
        require(!mcps[_mcpId].isApproved, "MCP already approved");
        
        mcps[_mcpId].isActive = false;
        
        emit MCPRejected(_mcpId, msg.sender);
    }
    
    /**
     * @dev Use an MCP
     * @param _mcpId ID of the MCP to use
     * @param _calls Number of API calls to make
     */
    function useMCP(uint256 _mcpId, uint256 _calls) public nonReentrant {
        require(_mcpId < mcpCount, "MCP does not exist");
        require(mcps[_mcpId].isApproved && mcps[_mcpId].isActive, "MCP not approved or inactive");
        require(_calls > 0, "Calls must be greater than 0");
        
        MCP storage mcp = mcps[_mcpId];
        uint256 totalCost = mcp.pricePerCall * _calls;
        
        require(sagaToken.transferFrom(msg.sender, address(this), totalCost), "Token transfer failed");
        
        // Update MCP usage statistics
        mcp.totalCalls += _calls;
        mcp.totalRevenue += totalCost;
        
        // Update user usage
        userMCPCalls[_mcpId][msg.sender] += _calls;
        
        // Find or create user usage record
        bool found = false;
        for (uint256 i = 0; i < userUsage[msg.sender].length; i++) {
            if (userUsage[msg.sender][i].mcpId == _mcpId) {
                userUsage[msg.sender][i].calls += _calls;
                userUsage[msg.sender][i].lastUsed = block.timestamp;
                found = true;
                break;
            }
        }
        
        if (!found) {
            userUsage[msg.sender].push(Usage({
                mcpId: _mcpId,
                user: msg.sender,
                calls: _calls,
                lastUsed: block.timestamp
            }));
        }
        
        emit MCPUsed(_mcpId, msg.sender, _calls);
    }
    
    /**
     * @dev Collect revenue for an MCP
     * @param _mcpId ID of the MCP to collect revenue for
     */
    function collectRevenue(uint256 _mcpId) public nonReentrant {
        require(_mcpId < mcpCount, "MCP does not exist");
        require(mcps[_mcpId].owner == msg.sender, "Not the MCP owner");
        
        uint256 revenue = mcps[_mcpId].totalRevenue;
        require(revenue > 0, "No revenue to collect");
        
        mcps[_mcpId].totalRevenue = 0;
        require(sagaToken.transfer(msg.sender, revenue), "Token transfer failed");
        
        emit RevenueCollected(_mcpId, msg.sender, revenue);
    }
    
    /**
     * @dev Get MCP details
     * @param _mcpId ID of the MCP to get details for
     */
    function getMCP(uint256 _mcpId) public view returns (
        uint256 id,
        string memory name,
        string memory description,
        string memory apiEndpoint,
        string memory implementation,
        address owner,
        uint256 pricePerCall,
        bool isApproved,
        bool isActive,
        uint256 totalCalls,
        uint256 totalRevenue
    ) {
        require(_mcpId < mcpCount, "MCP does not exist");
        MCP storage mcp = mcps[_mcpId];
        return (
            mcp.id,
            mcp.name,
            mcp.description,
            mcp.apiEndpoint,
            mcp.implementation,
            mcp.owner,
            mcp.pricePerCall,
            mcp.isApproved,
            mcp.isActive,
            mcp.totalCalls,
            mcp.totalRevenue
        );
    }
    
    /**
     * @dev Get user's MCP usage
     * @param _user Address of the user
     * @param _mcpId ID of the MCP
     */
    function getUserMCPUsage(address _user, uint256 _mcpId) public view returns (uint256) {
        return userMCPCalls[_mcpId][_user];
    }
    
    /**
     * @dev Get all user's MCP usage
     * @param _user Address of the user
     */
    function getUserUsage(address _user) public view returns (Usage[] memory) {
        return userUsage[_user];
    }
    
    /**
     * @dev Set minimum approval votes
     * @param _minApprovalVotes New minimum approval votes
     */
    function setMinApprovalVotes(uint256 _minApprovalVotes) public onlyRole(ADMIN_ROLE) {
        minApprovalVotes = _minApprovalVotes;
    }
    
    /**
     * @dev Add a reviewer
     * @param _reviewer Address of the reviewer to add
     */
    function addReviewer(address _reviewer) public onlyRole(ADMIN_ROLE) {
        grantRole(REVIEWER_ROLE, _reviewer);
    }
    
    /**
     * @dev Remove a reviewer
     * @param _reviewer Address of the reviewer to remove
     */
    function removeReviewer(address _reviewer) public onlyRole(ADMIN_ROLE) {
        revokeRole(REVIEWER_ROLE, _reviewer);
    }
} 