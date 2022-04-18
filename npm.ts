import {existsSync} from 'https://deno.land/std/fs/mod.ts';
import {EventSource} from './EventSource.ts';

function encodeUrl(url: string) {
    return url.replace(/@/g, '%40').replace(/\//g, '%2F');
}

const SEQ_FILE = 'seq/npm.seq';

const initialSeq = existsSync(SEQ_FILE)
    ? Deno.readTextFileSync(SEQ_FILE) || 'now'
    : 'now'

const url = `https://skimdb.npmjs.com/registry/_changes?since=${initialSeq}&feed=eventsource`

new EventSource(url).onmessage = async function (event: MessageEvent<string>) {
    const data: Data = JSON.parse(event.data);
    if (data.deleted) {
        console.log(data.id, 'deleted!');
    } else {
        const packageJson = await (await fetch(`https://skimdb.npmjs.com/${encodeUrl(data.id)}`)).json();
        const latest = packageJson['dist-tags'].latest;
        console.log(data.id, latest);
    }
    Deno.writeTextFileSync(SEQ_FILE, `${data.seq}`);
}

interface Data {
    seq: number;
    id: string;
    changes: { rev: string }[];
    deleted?: boolean;
}
