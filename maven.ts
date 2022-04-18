import {existsSync} from 'https://deno.land/std/fs/mod.ts';

const SEQ_FILE = 'seq/maven.timestamp';
const NB_ROWS_PER_PAGE = 20;
const POLLING_TIME_IN_MS = 60 * 1000;

let timestamp = existsSync(SEQ_FILE)
    ? Number.parseInt(Deno.readTextFileSync(SEQ_FILE)) || Date.now()
    : Date.now()

async function getSinceStart(timestamp: number, start = 0): Promise<Response> {
    const url = `https://search.maven.org/solrsearch/select?q=timestamp:%7B${timestamp}%20TO%20*%7D&rows=${NB_ROWS_PER_PAGE}&start=${start}&wt=json`;
    return await (await fetch(url)).json();
}

async function getSince(timestamp: number) {
    const artifacts = [];
    let foundArtifactsNumber = 0;

    do {
        if (artifacts.length > 0) {
            console.log(`Downloading page ${1 + artifacts.length / NB_ROWS_PER_PAGE}/${Math.ceil(foundArtifactsNumber / NB_ROWS_PER_PAGE)}...`);
        }
        const jsonData: Response = await getSinceStart(timestamp, artifacts.length);
        if (artifacts.length === 0) {
            foundArtifactsNumber = jsonData.response.numFound;
            if (foundArtifactsNumber > 0) {
                console.log(`Found ${foundArtifactsNumber} new artifacts since ${new Date(timestamp).toLocaleString()}`);
            }
        }
        artifacts.push(...jsonData.response.docs);
    } while (artifacts.length < foundArtifactsNumber)

    if (artifacts.length) {
        console.log(artifacts.map(artifact => `- ${artifact.id}`).join('\n'));
    }

    return artifacts.map(artifact => artifact.timestamp).reduce((acc, timestamp) => Math.max(acc, timestamp), timestamp);
}

const sync = async () => {
    timestamp = await getSince(timestamp);
    Deno.writeTextFileSync(SEQ_FILE, `${timestamp}`);
};
sync();
setInterval(sync, POLLING_TIME_IN_MS)

interface Response {
    responseHeader: {
        status: number;
        QTime: number;
        params: {
            q: string;
            core: string;
            spellcheck: string;
            indent: string;
            fl: string;
            start: string;
            sort: string;
            'spellcheck.count': string,
            rows: string,
            wt: string;
            version: string;
        }
    }
    response: {
        numFound: number;
        start: number;
        docs: {
            id: string;
            g: string;
            a: string;
            latestVersion: string;
            repositoryId: string;
            p: string;
            timestamp: number;
            versionCount: number;
            text: string[];
            ec: string[];
        }[]
    }
    spellcheck: {
        suggestion: any[]
    }
}
