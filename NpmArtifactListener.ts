import {EventSource} from './EventSource.ts';
import {Artifact, ArtifactId, ArtifactListener} from './ArtifactListener.ts';

function encodeUrl(url: string) {
    return url.replace(/@/g, '%40').replace(/\//g, '%2F');
}

export class NpmArtifactListener extends ArtifactListener<string | number> {
    defaultSequence = 'now';

    async start() {
        await super.start();
        await this.sync();
    }

    private async sync() {
        const url = `https://skimdb.npmjs.com/registry/_changes?since=${this.sequence}&feed=eventsource`;
        new EventSource(url).onmessage = (event: MessageEvent<string>) => {
            const data: NpmArtifact = JSON.parse(event.data);
            this.callback([data]);
        }
    }

    filterOutArtifact(artifactId: ArtifactId): boolean {
        const npmArtifact = artifactId as NpmArtifact;
        const deleted = !!npmArtifact.deleted;
        if (deleted) {
            console.log(`${this.constructor.name} > ${artifactId.id} has been deleted!`);
        }
        return deleted;
    }

    async getArtifactDetails(artifactId: ArtifactId): Promise<Artifact> {
        const npmArtifact = artifactId as NpmArtifact;
        const packageJson = await (await fetch(`https://skimdb.npmjs.com/${encodeUrl(npmArtifact.id)}`, {signal: AbortSignal.timeout(60000)})).json();
        const latest = packageJson['dist-tags'].latest;
        return Promise.resolve({
            id: npmArtifact.id,
            version: latest
        });
    }

    computeNextSequence(artifacts: NpmArtifact[]): number {
        return Math.max(artifacts[0].seq, this.sequence === this.defaultSequence ? 0 : this.sequence as number);
    }
}

export interface NpmArtifact extends ArtifactId {
    id: string;
    seq: number;
    changes: { rev: string }[];
    deleted?: boolean;
}
