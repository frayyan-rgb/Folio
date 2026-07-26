const majorVersion = Number.parseInt(process.versions.node.split(".")[0], 10);

if (majorVersion < 20 || majorVersion >= 26) {
  console.error(
    `Folio packaging requires Node.js 20–24 (found ${process.version}). ` +
      "Use Node.js 24 LTS and run the command again.",
  );
  process.exit(1);
}
