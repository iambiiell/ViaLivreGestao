module.exports = {
  packagerConfig: {
    icon: './icon', // Procura por icon.ico em builds Windows
    name: 'ViaLivre Gestão',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ViaLivreGestao',
        setupIcon: './icon.ico',
        setupExe: 'ViaLivre_Gestao_Setup.exe',
      },
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        renderer: [
          {
            config: 'vite.config.ts',
            entryPoints: [
              {
                html: './index.html',
                js: './src/main.tsx',
                name: 'main_window',
              }
            ]
          }
        ]
      }
    }
  ]
};
