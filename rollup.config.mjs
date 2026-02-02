import path from 'path'
import { fileURLToPath } from 'url'

import { defineConfig } from 'rollup'
import { dts } from 'rollup-plugin-dts'
import { visualizer } from 'rollup-plugin-visualizer'
import esbuild from 'rollup-plugin-esbuild'
import resolve from '@rollup/plugin-node-resolve'

const getPath = (name) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'packages', name)

function createConfig({ name, external = [], plugins = [] }) {
  const input = path.join(getPath(name), 'src', 'index.ts')
  const output = path.join(getPath(name), 'dist')

  return [
    {
      input,
      output: [
        {
          file: path.join(output, 'index.js'),
          format: 'cjs',
          sourcemap: false,
        },
        {
          file: path.join(output, 'index.esm.js'),
          format: 'esm',
          sourcemap: false,
        },
      ],
      external,
      plugins: [
        resolve(),
        esbuild({ minify: true }),
        visualizer({
          filename: path.join(getPath(name), 'stats.html'),
          title: `@peanutui/${name} bundle report`,
        }),
        ...plugins,
      ],
    },
    {
      input: path.join(output, 'types', 'index.d.ts'),
      output: { file: path.join(output, 'index.d.ts'), format: 'es' },
      plugins: [dts()],
    },
  ]
}

const packages = {
  core: () =>
    createConfig({
      name: 'core',
    }),
}

const target = process.env.TARGET

export default defineConfig(() => {
  const configFn = packages[target]
  if (!configFn) {
    throw new Error(`Unknown build target : ${target}`)
  }

  return configFn()
})
