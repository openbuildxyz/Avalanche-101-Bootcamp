import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

export function compile() {
  const sources = Object.fromEntries(fs.readdirSync('contracts').filter(f => f.endsWith('.sol'))
    .map(f => [`contracts/${f}`, { content: fs.readFileSync(`contracts/${f}`, 'utf8') }]));
  const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources,
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } }
  }), { import: name => {
    for (const p of [name, path.join('node_modules', name)]) {
      if (fs.existsSync(p)) return { contents: fs.readFileSync(p, 'utf8') };
    }
    return { error: `Missing import ${name}` };
  }}));
  const errors = (output.errors ?? []).filter(e => e.severity === 'error');
  if (errors.length) throw Error(errors.map(e => e.formattedMessage).join('\n'));
  fs.mkdirSync('artifacts', { recursive: true });
  const names = [];
  for (const [source, contracts] of Object.entries(output.contracts)) {
    if (source.startsWith('@')) continue;
    for (const [name, contract] of Object.entries(contracts)) {
      if (!contract.evm.bytecode.object) continue;
      fs.writeFileSync(`artifacts/${name}.json`, JSON.stringify({ abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object}` }, null, 2));
      names.push(name);
    }
  }
  console.log(`Compiled with solc ${solc.version()}: ${names.join(', ')}`);
}
compile();
