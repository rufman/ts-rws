import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import builtins from 'rollup-plugin-node-builtins';
import { terser } from 'rollup-plugin-terser';

const env = process.env.NODE_ENV;

const config = {
  input: 'src/index.ts',
  onwarn(warning) {
    throw Error(warning.message);
  },
  plugins: [builtins(), nodeResolve(), typescript()],
  output: {
    exports: 'named',
    indent: false,
    sourcemap: true,
  },
};

if (env === 'es' || env === 'cjs') {
  config.output.format = env;
}

if (env === 'development' || env === 'production') {
  config.output.format = 'umd';
  config.output.name = 'ts-rws';
}

if (env === 'production') {
  config.plugins.push(terser());
}

export default config;
