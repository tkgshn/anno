import * as esbuild from "esbuild";
import { mkdir, cp, rm } from "fs/promises";
import { join } from "path";

const log = (message: string) => console.log(`[build] ${message}`);
const error = (message: string) => console.error(`[build] ERROR: ${message}`);

async function clean() {
  try {
    await rm("dist", { recursive: true, force: true });
    log("Cleaned dist directory");
  } catch (e) {
    error(`Failed to clean dist: ${e}`);
  }
}

async function createDistDirectory() {
  await mkdir("dist", { recursive: true });
  log("Created dist directory");
}

async function copyStaticFiles() {
  const copies = [
    { src: "manifest.json", dest: "dist/manifest.json" },
    { src: "../../packages/chrome-extension/anno.png", dest: "dist/anno.png" },
    { src: "../../packages/chrome-extension/anno.png", dest: "dist/anno-512.png" }, // TODO: Create proper 512px icon
    { src: "../../packages/chrome-extension/anno.png", dest: "dist/anno-1024.png" }, // TODO: Create proper 1024px icon
    { src: "../../packages/chrome-extension/annotation.html", dest: "dist/annotation.html" },
    { src: "../../packages/chrome-extension/options.html", dest: "dist/options.html" },
    { src: "popup.html", dest: "dist/popup.html" },
  ];

  const results = await Promise.allSettled(
    copies.map(async ({ src, dest }) => {
      await cp(src, dest);
      log(`Copied ${src} to ${dest}`);
    })
  );

  const failed = results.filter(r => r.status === "rejected");
  if (failed.length > 0) {
    failed.forEach(r => {
      if (r.status === "rejected") {
        error(`Copy failed: ${r.reason}`);
      }
    });
    throw new Error(`${failed.length} file(s) failed to copy`);
  }
}

interface BuildEntry {
  entryPoints: string[];
  outfile: string;
}

async function buildJavaScriptFiles() {
  const entries: BuildEntry[] = [
    { entryPoints: ["src/annotation.ts"], outfile: "dist/annotation.js" },
    { entryPoints: ["src/background.ts"], outfile: "dist/background.js" },
    { entryPoints: ["src/content.ts"], outfile: "dist/content.js" },
    { entryPoints: ["src/gyanno.tsx"], outfile: "dist/gyanno.js" },
    { entryPoints: ["src/options.ts"], outfile: "dist/options.js" },
    { entryPoints: ["src/scrapboxContent.ts"], outfile: "dist/scrapboxContent.js" },
    { entryPoints: ["src/scrapboxUserScript.ts"], outfile: "dist/scrapboxUserScript.js" },
    { entryPoints: ["src/popup.ts"], outfile: "dist/popup.js" },
  ];

  // First, bundle webextension-polyfill
  log("Building polyfill bundle...");
  await esbuild.build({
    entryPoints: ["../../node_modules/webextension-polyfill/dist/browser-polyfill.js"],
    outfile: "dist/browser-polyfill.js",
    bundle: true,
    format: "iife",
    globalName: "browser",
    minify: true,
  });

  const results = await Promise.allSettled(
    entries.map(async (options) => {
      const start = Date.now();
      await esbuild.build({
        ...options,
        bundle: true,
        define: {
          "process.env.EXTENSION_ID": JSON.stringify(process.env.EXTENSION_ID || ""),
          "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
        },
        format: "esm",
        target: ["safari17", "chrome114"],
        minify: process.env.NODE_ENV === "production",
        sourcemap: process.env.NODE_ENV !== "production",
        treeShaking: true,
        platform: "browser",
        loader: {
          ".tsx": "tsx",
          ".ts": "ts",
        },
        inject: ["src/browser-polyfill.ts"],
        logLevel: "warning",
      });
      const time = Date.now() - start;
      log(`Built ${options.outfile} in ${time}ms`);
    })
  );

  const failed = results.filter(r => r.status === "rejected");
  if (failed.length > 0) {
    failed.forEach(r => {
      if (r.status === "rejected") {
        error(`Build failed: ${r.reason}`);
      }
    });
    throw new Error(`${failed.length} build(s) failed`);
  }
}

async function main() {
  try {
    log("Starting Safari extension build...");
    const startTime = Date.now();

    await clean();
    await createDistDirectory();
    await copyStaticFiles();
    await buildJavaScriptFiles();

    const totalTime = Date.now() - startTime;
    log(`✅ Build completed successfully in ${totalTime}ms`);
  } catch (e) {
    error(`Build failed: ${e}`);
    process.exit(1);
  }
}

// Run the build
main();