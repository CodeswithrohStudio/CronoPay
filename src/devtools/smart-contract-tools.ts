import { Contract, JsonRpcProvider, Wallet, Interface } from 'ethers';

export interface ContractInfo {
  address: string;
  name?: string;
  abi?: any[];
  functions?: string[];
  events?: string[];
}

export interface ContractCallResult {
  success: boolean;
  result?: any;
  error?: string;
  gasUsed?: string;
  txHash?: string;
}

export class SmartContractTools {
  private readonly rpcUrl: string;
  private readonly privateKey?: string;
  private static readonly CHAIN_ID = 338;

  constructor(rpcUrl?: string, privateKey?: string) {
    this.rpcUrl = rpcUrl || process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
    this.privateKey = privateKey || process.env.CRONOS_PRIVATE_KEY;
  }

  async inspectContract(address: string): Promise<ContractInfo> {
    const provider = new JsonRpcProvider(this.rpcUrl, SmartContractTools.CHAIN_ID);
    
    // Get bytecode to verify it's a contract
    const code = await provider.getCode(address);
    if (code === '0x') {
      throw new Error(`No contract found at address ${address}`);
    }

    // Try to get ERC20 info if it's a token
    const erc20Abi = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)',
    ];

    const info: ContractInfo = {
      address,
      functions: [],
      events: [],
    };

    try {
      const contract = new Contract(address, erc20Abi, provider);
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name().catch(() => null),
        contract.symbol().catch(() => null),
        contract.decimals().catch(() => null),
        contract.totalSupply().catch(() => null),
      ]);

      if (name) {
        info.name = `${name} (${symbol})`;
        info.functions = ['name', 'symbol', 'decimals', 'totalSupply', 'balanceOf', 'transfer', 'approve', 'transferFrom'];
        info.events = ['Transfer', 'Approval'];
      }
    } catch (error) {
      // Not an ERC20 token
    }

    return info;
  }

  async readContract(
    address: string,
    abi: any[],
    functionName: string,
    args: any[] = []
  ): Promise<ContractCallResult> {
    try {
      const provider = new JsonRpcProvider(this.rpcUrl, SmartContractTools.CHAIN_ID);
      const contract = new Contract(address, abi, provider);

      const result = await contract[functionName](...args);

      return {
        success: true,
        result: result.toString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async writeContract(
    address: string,
    abi: any[],
    functionName: string,
    args: any[] = []
  ): Promise<ContractCallResult> {
    if (!this.privateKey) {
      return {
        success: false,
        error: 'Private key not configured',
      };
    }

    try {
      const provider = new JsonRpcProvider(this.rpcUrl, SmartContractTools.CHAIN_ID);
      const wallet = new Wallet(this.privateKey, provider);
      const contract = new Contract(address, abi, wallet);

      const tx = await contract[functionName](...args);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async estimateGas(
    address: string,
    abi: any[],
    functionName: string,
    args: any[] = []
  ): Promise<{ gasEstimate: string; gasCost: string }> {
    const provider = new JsonRpcProvider(this.rpcUrl, SmartContractTools.CHAIN_ID);
    const contract = new Contract(address, abi, provider);

    const gasEstimate = await contract[functionName].estimateGas(...args);
    const feeData = await provider.getFeeData();
    const gasCost = gasEstimate * (feeData.gasPrice || 0n);

    return {
      gasEstimate: gasEstimate.toString(),
      gasCost: gasCost.toString(),
    };
  }

  async decodeTransaction(txHash: string): Promise<any> {
    const provider = new JsonRpcProvider(this.rpcUrl, SmartContractTools.CHAIN_ID);
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      throw new Error(`Transaction ${txHash} not found`);
    }

    return {
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      data: tx.data,
      gasLimit: tx.gasLimit.toString(),
      gasPrice: tx.gasPrice?.toString(),
      nonce: tx.nonce,
      blockNumber: tx.blockNumber,
    };
  }

  generateContractInterface(abi: any[]): string {
    let code = '// Contract Interface\n\n';
    
    const iface = new Interface(abi);
    
    code += '// Read Functions:\n';
    iface.forEachFunction((func) => {
      if (func.stateMutability === 'view' || func.stateMutability === 'pure') {
        const params = func.inputs.map(i => `${i.type} ${i.name}`).join(', ');
        const returns = func.outputs?.map(o => o.type).join(', ') || 'void';
        code += `function ${func.name}(${params}) returns (${returns})\n`;
      }
    });
    
    code += '\n// Write Functions:\n';
    iface.forEachFunction((func) => {
      if (func.stateMutability !== 'view' && func.stateMutability !== 'pure') {
        const params = func.inputs.map(i => `${i.type} ${i.name}`).join(', ');
        code += `function ${func.name}(${params})\n`;
      }
    });
    
    code += '\n// Events:\n';
    iface.forEachEvent((event) => {
      const params = event.inputs.map(i => `${i.indexed ? 'indexed ' : ''}${i.type} ${i.name}`).join(', ');
      code += `event ${event.name}(${params})\n`;
    });
    
    return code;
  }
}
