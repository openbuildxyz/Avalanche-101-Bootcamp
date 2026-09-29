#!/usr/bin/env python3
"""Adapt Foundry's standard JSON interface to the pinned npm solc; no global solc installation."""
import os
import subprocess
import sys
import tempfile

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if '--version' in sys.argv:
    subprocess.run(['node', os.path.join(root, 'node_modules/solc/solc.js'), '--version'], check=True)
elif '--standard-json' in sys.argv:
    # solcjs's CLI can truncate large piped output. Use its library and synchronous file IO.
    with tempfile.TemporaryDirectory(prefix='bootcamp-solc-') as tmp:
        input_path, output_path = os.path.join(tmp, 'in.json'), os.path.join(tmp, 'out.json')
        with open(input_path, 'wb') as f:
            f.write(sys.stdin.buffer.read())
        code = "const fs=require('fs'),solc=require(process.argv[1]);fs.writeFileSync(process.argv[3],solc.compile(fs.readFileSync(process.argv[2],'utf8')));"
        subprocess.run(['node', '-e', code, os.path.join(root, 'node_modules/solc'), input_path, output_path], check=True)
        with open(output_path, 'rb') as f:
            sys.stdout.buffer.write(f.read())
else:
    sys.exit('Only --version and --standard-json are supported.')
