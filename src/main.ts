import { promises as fs } from "fs";
import PathUtils from "path";
import semver from "semver";
import * as core from "@actions/core";
import { exec } from "@actions/exec";
import { execSync } from "child_process";

async function setPrereleaseVersion() {
    const packageFile = "./package.json";
    const pkg = JSON.parse((await fs.readFile(packageFile)).toString());

    const gitRev = execSync("git rev-parse HEAD")
        .toString()
        .slice(0, 8);

    if (pkg.version.includes("-dev.")) {
        console.log("Prerelease version already set");
        process.exit(1);
    }

    pkg.version = `${semver.inc(
        pkg.version,
        "patch",
    )}-dev.${Date.now()}.${gitRev}`;

    await fs.writeFile(packageFile, JSON.stringify(pkg, null, "    "));
    console.log("Prerelease version: " + pkg.version);
}

async function run() {
    const tag = core.getInput("tag") || "next";

    if (!/[a-z]+/.test(tag)) {
        core.setFailed(`Invalid tag format "${tag}". Only a-z characters.`);
        return;
    }

    const type: "stable" | "prerelease" = core.getInput("type") as any;

    if (!["stable", "prerelease"].includes(type)) {
        core.setFailed(
            "You must set the 'type' input to 'stable' or 'prerelease'",
        );
        return;
    }

    const npmToken = core.getInput("token");

    if (!npmToken) {
        core.setFailed("'token' input not set");
        return;
    }

    await fs.writeFile(
        PathUtils.join(process.env.HOME || "~", ".npmrc"),
        `//registry.npmjs.org/:_authToken=${npmToken}`,
    );

    await exec("npm whoami");

    await exec("npm ci");

    if (type === "prerelease") {
        await setPrereleaseVersion();
        await exec(`npm publish --tag ${tag}`);
    } else {
        await exec("npm publish");
    }
}

run().catch(error => {
    console.log("Action failed", error);
    core.setFailed(error.message);
});
