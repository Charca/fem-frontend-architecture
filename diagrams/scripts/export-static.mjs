import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { chmod } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const publicBasePath = normalizePublicBasePath(process.env.DIAGRAMS_BASE_PATH ?? "");
const outputRoot = path.join(root, "dist");
const distDir = path.join(outputRoot, ...publicBasePath.split("/").filter(Boolean));
const cacheDir = path.join(root, ".cache", "structurizr-cli");
const jreCacheDir = path.join(root, ".cache", "jre");
const validateOnly = process.argv.includes("--validate-only");
const cliMode = process.env.STRUCTURIZR_CLI ?? "download";
const cliVersion = process.env.STRUCTURIZR_CLI_VERSION ?? "2025.11.09";
const javaVersion = process.env.JAVA_VERSION ?? "21";

const versions = readdirSync(root)
  .filter((entry) => /^v\d+$/i.test(entry))
  .filter((entry) => statSync(path.join(root, entry)).isDirectory())
  .filter((entry) => existsSync(path.join(root, entry, "workspace.dsl")))
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

if (versions.length === 0) {
  throw new Error("No versioned workspaces found. Add a v1/workspace.dsl file first.");
}

if (!validateOnly) {
  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  writeRootIndex(versions);
  writeOutputRootIndex();
}

for (const version of versions) {
  const workspace = `${version}/workspace.dsl`;
  const output = path.join("dist", ...publicBasePath.split("/").filter(Boolean), version);

  await runStructurizr(validateOnly ? "validate" : "export", {
    workspace,
    output,
  });

  if (!validateOnly) {
    applyLayoutOverrides(version, output);
  }
}

async function runStructurizr(command, { workspace, output }) {
  if (cliMode === "docker") {
    const args = [
      "run",
      "--rm",
      "-v",
      `${root}:/usr/local/structurizr`,
      "structurizr/cli:latest",
      command,
      "-workspace",
      workspace,
    ];

    if (command === "export") {
      args.push("-format", "static", "-output", output);
    }

    run("docker", args);
    return;
  }

  const cli = await resolveStructurizrCli();
  const javaHome = await resolveJavaHome();
  const args = [command, "-workspace", workspace];

  if (command === "export") {
    args.push("-format", "static", "-output", output);
  }

  run(cli, args, { javaHome });
}

async function resolveStructurizrCli() {
  const configured = process.env.STRUCTURIZR_CLI_PATH;
  if (configured) {
    return configured;
  }

  const installDir = path.join(cacheDir, cliVersion);
  const cli = path.join(installDir, "structurizr.sh");

  if (!existsSync(cli)) {
    await downloadCli(installDir);
  }

  return cli;
}

async function downloadCli(installDir) {
  mkdirSync(installDir, { recursive: true });

  const zipPath = path.join(installDir, "structurizr-cli.zip");
  const url = `https://github.com/structurizr/cli/releases/download/v${cliVersion}/structurizr-cli.zip`;

  console.log(`Downloading Structurizr CLI v${cliVersion}`);
  await download(url, zipPath);
  run("unzip", ["-q", "-o", zipPath, "-d", installDir]);
  await chmod(path.join(installDir, "structurizr.sh"), 0o755);
}

async function resolveJavaHome() {
  if (process.env.JAVA_HOME) {
    return process.env.JAVA_HOME;
  }

  const javaCheck = spawnSync("java", ["-version"], { stdio: "ignore" });
  if (javaCheck.status === 0) {
    return undefined;
  }

  const platform = detectJavaPlatform();
  const installDir = path.join(jreCacheDir, `${javaVersion}-${platform.os}-${platform.arch}`);

  if (!findJavaHome(installDir)) {
    await downloadJre(installDir, platform);
  }

  return findJavaHome(installDir);
}

async function downloadJre(installDir, platform) {
  mkdirSync(installDir, { recursive: true });

  const archivePath = path.join(installDir, "jre.tar.gz");
  const url = `https://api.adoptium.net/v3/binary/latest/${javaVersion}/ga/${platform.os}/${platform.arch}/jre/hotspot/normal/eclipse`;

  console.log(`Downloading Java ${javaVersion} runtime for ${platform.os}/${platform.arch}`);
  await download(url, archivePath);
  run("tar", ["-xzf", archivePath, "-C", installDir]);
}

function detectJavaPlatform() {
  const osMap = {
    darwin: "mac",
    linux: "linux",
  };

  const archMap = {
    arm64: "aarch64",
    x64: "x64",
  };

  const os = osMap[process.platform];
  const arch = archMap[process.arch];

  if (!os || !arch) {
    throw new Error(`Unsupported platform for automatic Java download: ${process.platform}/${process.arch}`);
  }

  return { os, arch };
}

function findJavaHome(searchRoot) {
  if (!existsSync(searchRoot)) {
    return undefined;
  }

  const javaBin = findFile(searchRoot, "java", (filePath) => path.basename(path.dirname(filePath)) === "bin");

  if (!javaBin) {
    return undefined;
  }

  return path.dirname(path.dirname(javaBin));
}

function findFile(directory, fileName, predicate) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const found = findFile(entryPath, fileName, predicate);
      if (found) {
        return found;
      }
    }

    if (entry.isFile() && entry.name === fileName && predicate(entryPath)) {
      return entryPath;
    }
  }

  return undefined;
}

function download(url, destination) {
  const file = createWriteStream(destination);

  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          file.close();
          download(response.headers.location, destination).then(resolve, reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", reject);
  });
}

function run(command, args, options = {}) {
  const env = { ...process.env };

  if (options.javaHome) {
    env.JAVA_HOME = options.javaHome;
    env.PATH = `${path.join(options.javaHome, "bin")}${path.delimiter}${env.PATH}`;
  }

  env.PATH = `${path.join(root, "bin")}${path.delimiter}${env.PATH}`;

  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function applyLayoutOverrides(version, output) {
  const overridesPath = path.join(root, version, "layout-overrides.json");
  const workspacePath = path.join(root, output, "workspace.js");

  if (!existsSync(overridesPath) || !existsSync(workspacePath)) {
    return;
  }

  const overrides = JSON.parse(readFileSync(overridesPath, "utf8"));
  const workspaceJs = readFileSync(workspacePath, "utf8");
  const match = workspaceJs.match(/const jsonAsString = '([^']+)';/);

  if (!match) {
    throw new Error(`Could not find encoded workspace JSON in ${workspacePath}`);
  }

  const workspace = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
  const elementIdsByName = getElementIdsByName(workspace);
  const relationshipsByName = getRelationshipsByName(workspace, elementIdsByName);
  const views = [
    ...(workspace.views.systemLandscapeViews ?? []),
    ...(workspace.views.systemContextViews ?? []),
    ...(workspace.views.containerViews ?? []),
    ...(workspace.views.componentViews ?? []),
    ...(workspace.views.dynamicViews ?? []),
    ...(workspace.views.deploymentViews ?? []),
  ];

  for (const [viewKey, viewOverrides] of Object.entries(overrides.views ?? {})) {
    const view = views.find((candidate) => candidate.key === viewKey);
    if (!view) {
      throw new Error(`Could not find view "${viewKey}" while applying ${overridesPath}`);
    }

    for (const [elementName, position] of Object.entries(viewOverrides.elements ?? {})) {
      const elementId = elementIdsByName.get(elementName);
      if (!elementId) {
        throw new Error(`Could not find element "${elementName}" while applying ${overridesPath}`);
      }

      const element = view.elements?.find((candidate) => candidate.id === elementId);
      if (!element) {
        throw new Error(`Element "${elementName}" is not in view "${viewKey}"`);
      }

      element.x = position.x;
      element.y = position.y;
    }

    for (const [relationshipName, relationshipOverrides] of Object.entries(viewOverrides.relationships ?? {})) {
      const relationshipId = relationshipsByName.get(relationshipName);
      if (!relationshipId) {
        throw new Error(`Could not find relationship "${relationshipName}" while applying ${overridesPath}`);
      }

      const relationship = view.relationships?.find((candidate) => candidate.id === relationshipId);
      if (!relationship) {
        throw new Error(`Relationship "${relationshipName}" is not in view "${viewKey}"`);
      }

      Object.assign(relationship, relationshipOverrides);
    }

    expandViewDimensions(view);
  }

  const encoded = Buffer.from(JSON.stringify(workspace)).toString("base64");
  writeFileSync(workspacePath, workspaceJs.replace(match[1], encoded));
}

function expandViewDimensions(view) {
  if (!view.elements?.length) {
    return;
  }

  const maxX = Math.max(...view.elements.map((element) => element.x ?? 0));
  const maxY = Math.max(...view.elements.map((element) => element.y ?? 0));

  view.dimensions = {
    width: Math.max(view.dimensions?.width ?? 0, maxX + 900),
    height: Math.max(view.dimensions?.height ?? 0, maxY + 700),
  };
}

function getElementIdsByName(workspace) {
  const ids = new Map();

  for (const person of workspace.model.people ?? []) {
    ids.set(person.name, person.id);
  }

  for (const softwareSystem of workspace.model.softwareSystems ?? []) {
    ids.set(softwareSystem.name, softwareSystem.id);

    for (const container of softwareSystem.containers ?? []) {
      ids.set(container.name, container.id);
    }
  }

  return ids;
}

function getRelationshipsByName(workspace, elementIdsByName) {
  const elementNamesById = new Map([...elementIdsByName].map(([name, id]) => [id, name]));
  const relationships = new Map();
  const elements = [
    ...(workspace.model.people ?? []),
    ...(workspace.model.softwareSystems ?? []),
    ...((workspace.model.softwareSystems ?? []).flatMap((softwareSystem) => softwareSystem.containers ?? [])),
  ];

  for (const element of elements) {
    for (const relationship of element.relationships ?? []) {
      const sourceName = elementNamesById.get(relationship.sourceId);
      const destinationName = elementNamesById.get(relationship.destinationId);

      if (sourceName && destinationName) {
        relationships.set(`${sourceName} -> ${destinationName}`, relationship.id);
      }
    }
  }

  return relationships;
}

function writeRootIndex(versions) {
  const links = versions
    .map((version) => `        <li><a href="${publicBasePath}/${version}/">${version.toUpperCase()}</a></li>`)
    .join("\n");

  writeFileSync(
    path.join(distDir, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>C4 Diagrams</title>
    <style>
      body {
        color: #1f2933;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
        margin: 0;
      }

      main {
        margin: 0 auto;
        max-width: 720px;
        padding: 64px 24px;
      }

      h1 {
        font-size: 2rem;
        line-height: 1.1;
        margin: 0 0 16px;
      }

      ul {
        padding-left: 24px;
      }

      a {
        color: #0f766e;
        font-weight: 650;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>C4 Diagrams</h1>
      <p>Select a diagram version.</p>
      <ul>
${links}
      </ul>
    </main>
  </body>
</html>
`,
  );
}

function writeOutputRootIndex() {
  if (!publicBasePath) {
    return;
  }

  writeFileSync(
    path.join(outputRoot, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=${publicBasePath}/">
    <link rel="canonical" href="${publicBasePath}/">
    <title>C4 Diagrams</title>
  </head>
  <body>
    <p><a href="${publicBasePath}/">Open C4 diagrams</a></p>
  </body>
</html>
`,
  );
}

function normalizePublicBasePath(value) {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}
