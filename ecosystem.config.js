module.exports = {
    apps: [
        {
            name: "pre-update",
            script: "./scripts/pre-update.ts",
            cwd: __dirname,
            env: {
                TS_NODE_PROJECT: "/root/server-dotfiles/tsconfig.json",
            },
        },
    ],
};
