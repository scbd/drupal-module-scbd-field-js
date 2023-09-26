import { defineConfig        } from 'vite'
import { terser              } from 'rollup-plugin-terser'
import   vue                   from '@vitejs/plugin-vue'
import postCssPurge from '@fullhuman/postcss-purgecss';


const alias = [ { find: '@', replacement:'/src' } ]

const config = {
    plugins  : [ vue() ],
    css      : { postcss: { plugins: [ postCssPurge({ contentFunction, defaultExtractor }) ] } },
    resolve: {
      alias,
      dedupe: [ 'vue' ],
      preserveSymlinks: false
    },
    build    : {
        outDir:'dist', emptyOutDir:true,  sourcemap:true, copyPublicDir : false,
        lib      : { formats:['iife'], entry:'src/index.js', name:'ScbdDrupalScbdFieldJs', fileName:'index.min.js' }, // lib build as opposed to app build
        rollupOptions: {
            external: ['vue'],
          output: {
            exports: 'named',
            globals: { vue: 'Vue' }
          },
          plugins: [terser({ output: { comments: true } })]
        },
      }
}
export default defineConfig(config)


const vuePath = /\.vue(\?.+)?$/;

function contentFunction (sourceInputFile) {
    if (vuePath.test(sourceInputFile))
      return [sourceInputFile.replace(vuePath, '.vue')];
  
    return ['src/**/*.vue', 'index.html'];
  }
  
  function defaultExtractor(content) {
    if (content.startsWith('<template'))
      content = content.split('</template')[0] + '</template>';
  
    return content.match(/[\w-/:]+(?<!:)/g) || [];
  }