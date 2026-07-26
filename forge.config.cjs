const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: "com.frayyan.folio",
    appCategoryType: "public.app-category.productivity",
    icon: path.join(__dirname, "assets", "folio-icon.icns"),
    extraResource: ["resources/llama"],
    ignore: [
      /^\/\.env($|\.)/,
      /^\/\.gitignore$/,
      /^\/README\.md$/,
      /^\/assets\/folio-icon\.icns$/,
      /^\/components\.json$/,
      /^\/docs($|\/)/,
      /^\/eslint\.config\.js$/,
      /^\/forge\.config\.cjs$/,
      /^\/index\.html$/,
      /^\/llama\.cpp($|\/)/,
      /^\/node_modules($|\/)/,
      /^\/public($|\/)/,
      /^\/resources($|\/)/,
      /^\/scripts($|\/)/,
      /^\/src($|\/)/,
      /^\/tests($|\/)/,
      /^\/tmp($|\/)/,
      /^\/tsconfig(\..+)?\.json$/,
      /^\/vite\.config\.ts$/,
      /^\/yarn\.lock$/,
    ],
  },
  rebuildConfig: {},
  hooks: {
    postPackage: async (_forgeConfig, packageResult) => {
      if (packageResult.platform !== "darwin") return;

      for (const outputPath of packageResult.outputPaths) {
        const appBundle = (await fs.readdir(outputPath)).find((entry) =>
          entry.endsWith(".app"),
        );

        if (!appBundle) {
          throw new Error(`No macOS app bundle found in ${outputPath}`);
        }

        await execFileAsync("codesign", [
          "--force",
          "--deep",
          "--sign",
          "-",
          path.join(outputPath, appBundle),
        ]);
      }
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-dmg",
      config: {
        format: "ULFO",
        icon: path.join(__dirname, "assets", "folio-icon.icns"),
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-squirrel",
      config: {},
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
