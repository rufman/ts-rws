import builtins from 'rollup-plugin-node-builtins';
import nodeResolve from 'rollup-plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript';

const env = process.env.NODE_ENV;

const config = {
  input: 'src/index.ts',
  onwarn: (warning) => {
    throw new Error(warning.message);
  },
  plugins: [builtins(), nodeResolve(), typescript()],
};

if (env === 'es' || env === 'cjs') {
  config.output = {
    exports: 'named',
    format: env,
    indent: false,
  };
}

if (env === 'development' || env === 'production') {
  config.output = {
    exports: 'named',
    format: 'umd',
    indent: false,
    name: 'ts-rws',
  };
}

if (env === 'production') {
  config.plugins.push(terser());
}

export default config;
