import {Artifact, ArtifactId, ArtifactListener} from './ArtifactListener.ts';
import {parseFeed} from 'https://deno.land/x/rss@0.5.5/mod.ts';
import {FeedEntry} from 'https://deno.land/x/rss@0.5.5/src/types/feed.ts';

const URL = `https://pypi.org/rss/updates.xml`;
const POLLING_TIME_IN_MS = 1000;

export class PypiArtifactListener extends ArtifactListener<number> {
    defaultSequence = 0;
    #etag?: string;

    async start() {
        await super.start();
        await this.sync();
    }

    getArtifactDetails(artifact: ArtifactId): Promise<Artifact> {
        const pypiArtifact = artifact as PypiArtifact;
        return Promise.resolve({
            id: pypiArtifact.id,
            version: pypiArtifact.version
        });
    }

    private async sync() {
        let artifacts: PypiArtifact[] = [];
        try {
            artifacts = await this.getSince();
        } catch (e) {
            console.error(`${this.listenerName} > Error while querying API`, e);
        }
        this.callback(artifacts);
        setTimeout(() => this.sync(), POLLING_TIME_IN_MS);
    }

    private async getSince(): Promise<PypiArtifact[]> {
        const headers = this.#etag ? {'if-none-match': this.#etag} : undefined;
        const response = await fetch(URL, {signal: AbortSignal.timeout(1000), headers});
        this.#etag = response.headers.get('etag') || undefined;
        if (response.status === 200) {
            const {entries}: { entries: FeedEntry[] } = await parseFeed(await response.text());
            const data = entries.map(entry => {
                const [packageName, version] = entry.title!.value!.split(' ');
                return {id: packageName, version, published: entry.published!} as PypiArtifact;
            });
            return data.filter((d) => d.published.getTime() > this.sequence);
        }
        return [];
    }

    computeNextSequence(artifacts: PypiArtifact[]): number {
        return Math.max(...artifacts.map(a => a.published.getTime()), this.sequence);
    }
}

export interface PypiArtifact extends ArtifactId {
    version: string;
    published: Date;
}
