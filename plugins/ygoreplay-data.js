const axios = require("axios");
const NodeFormData = require("form-data");
const fs = require("fs");
const path = require("path");
const countFilePath = path.join(process.cwd(), "count");
ygopro.stoc_follow_after("REPLAY", false, async (replayData, info, client) => {
    try {
        if (!fs.existsSync(countFilePath)) {
            fs.writeFileSync(countFilePath, "0");
        }

        const room = ROOM_all[client.rid];
        if (client.pos === 0) {
            const finishedTime = Buffer.from(moment().format("YYYY-MM-DD HH:mm:ss"));
            const rules = Buffer.from(JSON.stringify(room.hostinfo));
            const bufferSeparator = Buffer.from([0, 1, 0, 1, 0]);
            const playerNames = [];
            for (let i = 0, j = 0; j < room.dueling_players.length; i = ++j) {
                const player = room.dueling_players[i];
                playerNames.push(player.name, player.pos);
            }
            const data = Buffer.concat([
                finishedTime,
                bufferSeparator,
                rules,
                bufferSeparator,
                Buffer.from(playerNames.join("\0\1\2\3")),
                bufferSeparator,
                replayData,
            ]);
            const formData = new NodeFormData();
            formData.append("data", data, {
                filename: "data.bin",
            });
            await axios({
                url: "https://data.ygoreplay.com/replay/upload",
                method: "POST",
                data: formData,
                headers: formData.getHeaders(),
            });

            const count = parseInt(fs.readFileSync(countFilePath).toString(), 10);
            console.info(`Replay of match #${count + 1} uploaded successfully.`);

            fs.writeFileSync(countFilePath, `${count + 1}`);
        }
    } catch (e) {
        log.warn("ygoreplay post failed", e.toString());
    }
    return false;
});
