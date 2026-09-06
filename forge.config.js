module.exports = {
  packagerConfig: {
    icon: './assets/icon', // Sem extensão, o forge procura .ico no Windows
    name: 'ViaLivre',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ViaLivre',
        setupIcon: './assets/icon.ico',
        setupExe: 'ViaLivre-Instalador.exe',
      },
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // Build configuration for the renderer process
        renderer: [
          {
            config: 'vite.config.ts',
            entryPoints: [
              {
                html: './index.html',
                js: './index.tsx',
                name: 'main_window',
              }
            ]
          }
        ]
      }
    }
  ]
};
