import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';

import pkg from './package.json';

const name = pkg.name
  .replace(/^(@\S+\/)?(beyondnft)?(\S+)/, '$3')
  .replace(/^\w/, (m) => m.toUpperCase())
  .replace(/-\w/g, (m) => m[1].toUpperCase());

const production = !process.env.ROLLUP_WATCH;

function serve() {
  let server;

  function toExit() {
    if (server) server.kill(0);
  }

  return {
    writeBundle() {
      if (server) return;
      server = require('child_process').spawn(
        'npm',
        ['run', 'start', '--', '--dev'],
        {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true,
        }
      );

      process.on('SIGTERM', toExit);
      process.on('exit', toExit);
    },
  };
}

const output = [
  { file: pkg.module.replace('.min.js', '.js'), format: 'es' },
  { file: pkg.main.replace('.min.js', '.js'), format: 'umd', name },
];

if (!production) {
  output.push({
    file: 'public/' + pkg.module.replace('.min.js', '.js'),
    format: 'es',
  });
} else {
  output.push(
    {
      file: pkg.module,
      format: 'es',
      plugins: [terser()],
    },
    {
      file: pkg.main,
      format: 'umd',
      name,
      plugins: [terser()],
    }
  );
}

export default {
  input: 'src/main.js',
  output,
  plugins: [
    json(),
    replace({
      'process.env.NODE_ENV': JSON.stringify(
        production ? 'production' : 'development'
      ),
      'process.env.npm_package_version': JSON.stringify(
        process.env.npm_package_version
      ),
    }),
    svelte({
      // enable run-time checks when not in production
      dev: !production,
    }),

    resolve({
      browser: true,
      dedupe: ['svelte'],
    }),
    commonjs(),

    // In dev mode, call `npm run start` once
    // the bundle has been generated
    !production && serve(),

    // Watch the `public` directory and refresh the
    // browser on changes when not in production
    !production && livereload('public'),
  ],
  watch: {
    clearScreen: false,
  },
  onwarn(warning, warn) {
    // skip web3 uses eval warning, because it makes vs-code crash
    if (warning.code === 'EVAL') return;

    warn(warning);
  },
};
