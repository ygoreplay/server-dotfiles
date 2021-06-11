module.exports = {
    apps: [
        {
            name: "yarn",
            script: "yarn",
            args: "pre-update",
            cwd: __dirname,
            interpreter: "/bin/bash",
        },
    ],
};
