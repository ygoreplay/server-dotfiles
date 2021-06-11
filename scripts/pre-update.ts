import { JSDOM } from "jsdom";
import * as moment from "moment";
import * as path from "path";
import * as schedule from "node-schedule";
import * as fs from "fs-extra";
import * as util from "util";
import fetch from "node-fetch";
import * as unzipper from "unzipper";
import { Readable } from "stream";
import * as shelljs from "shelljs";
import * as YAML from 'yaml'

const streamPipeline = util.promisify(require('stream').pipeline)

const LAST_UPDATE_FILE_PATH = path.join(process.cwd(), ".pre-last-date");
const PRE_RELEASE_DATA_DOWNLOAD_PATH = path.join(process.cwd(), ".prerelase.zip")
const TEMP_PATH = path.join(process.cwd(), ".tmp");
const PRE_EXPANSIONS_PATH = path.join(process.cwd(), "./pre-expansions");

async function download(url: string, path: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);

    await streamPipeline(response.body, fs.createWriteStream(path))
}

const check =
    (async () => {
        const { window: { document } } = await JSDOM.fromURL("https://ygo233.com/pre");
        const downloadButton = document.querySelector("body > div > div:nth-child(2) > div > p.buttons > a:nth-child(1)");
        if (!downloadButton) {
            console.error("There was no download button @ `ygo233.com/pre`.")
        }

        const downloadUrl = downloadButton.getAttribute("href");
        if (!downloadUrl) {
            console.error("There was no downloadable url on button @ `ygo233.com/pre`.")
        }

        const publishedDate = downloadUrl.replace(/.*?([0-9]{4}[0-9]{2}[0-9]{2}[0-9]{2}[0-9]{2}[0-9]{2}).*/g, "$1");
        const published = moment(publishedDate, "YYYYMMDDHHmmss").unix();
        if(!fs.existsSync(LAST_UPDATE_FILE_PATH)) {
            fs.writeFileSync(LAST_UPDATE_FILE_PATH, "19700101000000");
        }

        const lastUpdated = moment(fs.readFileSync(LAST_UPDATE_FILE_PATH).toString(), "YYYYMMDDHHmmss").unix();
        if (!fs.existsSync(LAST_UPDATE_FILE_PATH) || lastUpdated < published) {
            fs.writeFileSync(LAST_UPDATE_FILE_PATH, `${publishedDate}`);
            fs.ensureDirSync(PRE_EXPANSIONS_PATH);

            await download(downloadUrl, PRE_RELEASE_DATA_DOWNLOAD_PATH);
            const zip = fs.createReadStream(PRE_RELEASE_DATA_DOWNLOAD_PATH).pipe(unzipper.Parse({ forceStream: true }));
            for await (const _entry of zip) {
                const entry: unzipper.Entry = _entry;
                if (!entry.path.endsWith(".ypk")) {
                    continue;
                }

                const ypkBuffer = await entry.buffer();
                const readable = new Readable();
                readable._read = () => {};
                readable.push(ypkBuffer);
                readable.push(null);

                const ypkStream = readable.pipe(unzipper.Parse({ forceStream: true }));
                for await (const __entry of ypkStream) {
                    const ypkEntry: unzipper.Entry = __entry;
                    if (ypkEntry.type === "Directory") {
                        continue;
                    }

                    const targetPath = path.join(PRE_EXPANSIONS_PATH, ypkEntry.path);

                    await fs.ensureDir(path.dirname(targetPath));
                    await fs.writeFile(targetPath, await ypkEntry.buffer());

                    console.info(targetPath);
                }
            }
        }

        // restart pre-release server.
        const compose = YAML.parse(fs.readFileSync(path.join(process.cwd(), "./docker-compose.yml")).toString());
        const serverName = compose.services["pro-server-pre-release"].container_name;
        const exec = shelljs.exec(`docker restart ${serverName}`);
        if (exec.code !== 0) {
            console.error(`Failed to restart ${serverName} conatiner!`)
        }
    });

schedule.scheduleJob("0 0 4 * * *", function () {
    check();
})

check();
